import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import type { Capabilities } from "@wdio/types"
import { promises as fsPromises } from "node:fs"
import os from "node:os"
import path from "node:path"
import { Readable } from "node:stream"
import pLimit from "p-limit"
import {
  TestResult,
  ScreenshotTest,
  createSummaryForBuild,
  createMarkdownForBuildResult,
  createSummaryForFailedBuild,
} from "shared"
import { extract } from "tar"
import { Not, In } from "typeorm"
import { remote } from "webdriverio"

import { Database } from "./database"
import { downloadWithTimeout } from "./download"
import { IS_PRODUCTION, S3_BUCKET_NAME } from "./environment"
import { updateGitHubCheckRun, type GitHubCheckData } from "./github"
import { getGitLabHostConfig, updateGitLabCommitStatus, type GitLabCheckData } from "./gitlab"
import { log } from "./log"
import { startStaticServer } from "./server"
import { getStorybookStories, navigateToStorybook, processStory } from "./stories"

export async function ingestStorybook(
  projectId: string,
  screenshotTestId: number,
  uploadId: string,
  githubCheckData?: GitHubCheckData,
  gitlabCheckData?: GitLabCheckData,
): Promise<void> {
  log.info(`Starting storybook ingestion for project ${projectId}, upload ${uploadId}`)

  // Fetch the screenshot test record (project and user loaded via eager relations)
  const db = await Database()
  const screenshotTestRepo = db.getRepository(ScreenshotTest)
  const screenshotTest = await screenshotTestRepo.findOneBy({ id: screenshotTestId })
  if (!screenshotTest) {
    throw new Error(`Screenshot test not found: ${screenshotTestId}`)
  }

  // Resolve the configured GitLab service token by host at processing time (never stored in task data).
  const gitlabHost = gitlabCheckData
    ? (screenshotTest.project.gitlabHost ?? gitlabCheckData.gitlabHost)
    : undefined
  const gitlabConfigured = gitlabHost ? getGitLabHostConfig(gitlabHost) != undefined : false
  if (gitlabCheckData && !gitlabConfigured) {
    log.warn(
      { projectId: screenshotTest.project.id, gitlabHost },
      "Skipping GitLab commit status updates: no service token configured for host",
    )
  }

  // Update VCS status based on provider
  if (githubCheckData) {
    try {
      await updateGitHubCheckRun({
        owner: githubCheckData.owner,
        repo: githubCheckData.repo,
        installationId: githubCheckData.installationId,
        checkRunId: githubCheckData.checkRunId,
        testId: screenshotTestId,
        status: "queued",
        title: "Rendering storybook components…",
        summary: createSummaryForBuild(screenshotTest),
      })
    } catch (error) {
      log.error(error, "Failed to update GitHub check run to in-progress")
      // Continue with the ingest process even if the GitHub API call fails
    }
  } else if (gitlabCheckData && gitlabConfigured && gitlabHost) {
    await updateGitLabCommitStatus({
      ...gitlabCheckData,
      gitlabHost,
      state: "running",
      testId: screenshotTestId,
      name: "vizdiff/visual-tests",
      description: "Rendering storybook components…",
    })
  }

  // Clean up previous test results for the same commit/branch
  if (screenshotTest.commitSha && screenshotTest.branch) {
    log.info(`Cleaning up previous test results for the same commit/branch if they exist`)

    // Use a transaction to ensure atomicity
    await db.transaction(async (transactionalEntityManager) => {
      const testResultRepo = transactionalEntityManager.getRepository(TestResult)
      const screenshotTestRepoTx = transactionalEntityManager.getRepository(ScreenshotTest)

      // Find previous screenshot tests with the same commit and branch
      const previousTests = await screenshotTestRepoTx.find({
        where: {
          commitSha: screenshotTest.commitSha,
          branch: screenshotTest.branch,
          project: { id: screenshotTest.project.id },
          id: Not(screenshotTest.id), // Exclude current test
        },
      })

      // Delete test results for these previous tests
      if (previousTests.length > 0) {
        const previousTestIds = previousTests.map((test) => test.id)
        const deleteResult = await testResultRepo.delete({
          screenshotTest: { id: In(previousTestIds) },
        })

        log.info(
          `Deleted ${deleteResult.affected ?? 0} test results from ${previousTests.length} previous test runs for the same commit`,
        )
      }
    })
  }

  // Initialize S3 client
  const s3Client = new S3Client()
  const bucket = await getS3BucketForProjectId(projectId)
  const key = `projects/${projectId}/${uploadId}.tar.gz`
  log.debug(`Using S3 bucket: ${bucket}, key: ${key}`)

  // Create temp directory for extraction
  const tmpDir = path.join(os.tmpdir(), `storybook-${uploadId}`)
  log.debug(`Creating temporary directory: ${tmpDir}`)
  await fsPromises.mkdir(tmpDir, { recursive: true })

  // Update the screenshot test status to running
  screenshotTest.status = "running"
  await screenshotTestRepo.save(screenshotTest)

  try {
    // Initialize the tarball download from S3
    const tarballPath = path.join(tmpDir, "storybook.tar.gz")
    log.info(`Downloading storybook build from S3 ${key} -> ${tarballPath}`)
    const getObjectCommand = new GetObjectCommand({ Bucket: bucket, Key: key })
    const response = await s3Client.send(getObjectCommand)
    if (!response.Body) {
      throw new Error("Empty response body from S3")
    }
    if (!(response.Body instanceof Readable)) {
      throw new Error(`Unexpected response.Body type ${typeof response.Body}`)
    }
    // Download the tarball to a temporary file
    await downloadWithTimeout(response.Body, tarballPath, 30 * 1000)
    log.debug(`Successfully downloaded storybook build from S3`)

    // Extract the tarball
    log.info(`Extracting storybook build to: ${tmpDir}`)
    await extract({ file: tarballPath, cwd: tmpDir })
    log.debug(`Successfully extracted storybook build`)

    // Initialize WebdriverIO
    log.debug("Initializing WebdriverIO in headless Chrome mode")
    const config: Capabilities.WebdriverIOConfig = {
      outputDir: path.join(tmpDir, "wdio-logs"),
      hostname: "localhost",
      port: IS_PRODUCTION ? 4444 : undefined,
      capabilities: {
        browserName: "chrome",
        "goog:chromeOptions": {
          args: ["--headless", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        },
      },
      logLevel: "warn",
    }
    const browser = await remote(config)
    screenshotTest.browserVersion = `${browser.capabilities.browserName}-${browser.capabilities.platformName}-${browser.capabilities.browserVersion}`
    log.info(
      { capabilities: browser.capabilities },
      `Successfully initialized WebdriverIO ${screenshotTest.browserVersion}`,
    )

    try {
      // Start a local server to serve the Storybook files
      const { server, port } = await startStaticServer(tmpDir)

      try {
        // Set the initial viewport
        await browser.setViewport({ width: 1200, height: 900, devicePixelRatio: 1 })

        // Navigate to the Storybook iframe and wait for stories to load
        await navigateToStorybook(browser, port)

        // Get the loaded stories
        const stories = await getStorybookStories(browser)
        if (Object.keys(stories).length === 0) {
          throw new Error("Storybook loaded but contains no stories")
        }

        const storyCount = Object.keys(stories).length
        if (storyCount === 0) {
          throw new Error("Storybook loaded but contains no stories")
        }

        log.info(`Found ${storyCount} stories to process`)

        const testResultTable = db.getRepository(TestResult)

        // Fetch test results from the base commit if it exists
        const baseTestResults = new Map<string, TestResult>()
        if (screenshotTest.baseCommitSha) {
          log.info(`Fetching base test results for commit ${screenshotTest.baseCommitSha}`)
          const baseTests = await testResultTable
            .createQueryBuilder("result")
            .leftJoinAndSelect("result.screenshotTest", "test")
            .where("test.commitSha = :commitSha", { commitSha: screenshotTest.baseCommitSha })
            .getMany()

          for (const test of baseTests) {
            baseTestResults.set(test.storyId, test)
          }
          log.info(`Found ${baseTestResults.size} base test results`)
        }

        // Process stories with a concurrency limit
        const MAX_CONCURRENCY = 4
        const limit = pLimit(MAX_CONCURRENCY)
        const testResults = await Promise.all(
          Object.values(stories).map((story) =>
            limit(() =>
              processStory({
                story,
                screenshotTest,
                baseTestResult: baseTestResults.get(story.id),
                bucket,
                tmpDir,
                projectId,
                uploadId,
                port,
                s3Client,
                testResultTable,
                browser,
              }),
            ),
          ),
        )
        log.info(
          `Successfully processed all ${Object.keys(stories).length} stories for test ${screenshotTest.id} (build #${screenshotTest.buildNumber})`,
        )

        let changeCount = 0
        for (const testResult of testResults) {
          if (testResult.changeStatus !== "unchanged") {
            changeCount++
          }
        }

        // Update the screenshot test status to completed
        const startedSec = screenshotTest.createdAt.getTime() / 1000
        screenshotTest.status = changeCount > 0 ? "unapproved" : "no_changes"
        screenshotTest.buildDurationSec = Date.now() / 1000 - startedSec
        screenshotTest.totalChanges = changeCount
        await screenshotTestRepo.save(screenshotTest)

        // Update VCS status with the build results
        if (githubCheckData) {
          await updateGitHubCheckRunWithBuildResults(
            githubCheckData,
            screenshotTest,
            testResults,
            changeCount,
          )
        } else if (gitlabCheckData && gitlabConfigured && gitlabHost) {
          const hasChanges = changeCount > 0
          if (!hasChanges) {
            // Only update status to success if no changes - otherwise stay in pending until approved
            await updateGitLabCommitStatus({
              ...gitlabCheckData,
              gitlabHost,
              state: "success",
              testId: screenshotTest.id,
              name: "vizdiff/visual-tests",
              description: "No visual changes detected",
            })
          } else {
            log.info(
              `GitLab status staying in pending for ${changeCount} unapproved change(s) - approval will set success`,
            )
          }
        }
      } finally {
        log.debug("Shutting down local server")
        await new Promise<void>((resolve) => server.close(() => resolve()))
      }
    } finally {
      log.debug("Closing WebdriverIO browser session")
      await browser.deleteSession()
    }
  } catch (error) {
    log.error(
      error,
      `Failed to process storybook in test ${screenshotTest.id} (build #${screenshotTest.buildNumber})`,
    )
    screenshotTest.status = "failed"
    await screenshotTestRepo.save(screenshotTest)

    // Update VCS status with failure
    if (githubCheckData) {
      try {
        await updateGitHubCheckRun({
          owner: githubCheckData.owner,
          repo: githubCheckData.repo,
          installationId: githubCheckData.installationId,
          checkRunId: githubCheckData.checkRunId,
          testId: screenshotTestId,
          status: "completed",
          conclusion: "failure",
          title: "⚠️ Failed to render storybook components.",
          summary: createSummaryForFailedBuild(screenshotTest, error),
        })
      } catch (githubError) {
        log.error(githubError, "Failed to update GitHub check run to failure")
      }
    } else if (gitlabCheckData && gitlabConfigured && gitlabHost) {
      await updateGitLabCommitStatus({
        ...gitlabCheckData,
        gitlabHost,
        state: "failed",
        testId: screenshotTestId,
        name: "vizdiff/visual-tests",
        description: "Failed to render storybook components",
      })
    }

    throw error
  } finally {
    // Cleanup
    log.debug(`Cleaning up temporary directory: ${tmpDir}`)
    await fsPromises.rm(tmpDir, { recursive: true, force: true })

    // If status is still "running", something went wrong without throwing an error
    if (screenshotTest.status === "running") {
      screenshotTest.status = "failed"
      await screenshotTestRepo.save(screenshotTest)

      // Update VCS status with cancelled
      if (githubCheckData) {
        try {
          await updateGitHubCheckRun({
            owner: githubCheckData.owner,
            repo: githubCheckData.repo,
            installationId: githubCheckData.installationId,
            checkRunId: githubCheckData.checkRunId,
            testId: screenshotTestId,
            status: "completed",
            conclusion: "cancelled",
            title: "Storybook rendering was cancelled or timed out.",
            summary: createSummaryForFailedBuild(screenshotTest, "Cancelled or timed out"),
          })
        } catch (error) {
          log.error(error, "Failed to update GitHub check run to cancelled")
        }
      } else if (gitlabCheckData && gitlabConfigured && gitlabHost) {
        await updateGitLabCommitStatus({
          ...gitlabCheckData,
          gitlabHost,
          state: "canceled",
          testId: screenshotTestId,
          name: "vizdiff/visual-tests",
          description: "Storybook rendering was cancelled or timed out",
        })
      }
    }

    log.info(
      `Storybook ingestion completed for ${screenshotTest.id} (build #${screenshotTest.buildNumber}) with status: ${screenshotTest.status}`,
    )
  }
}

async function updateGitHubCheckRunWithBuildResults(
  githubCheckData: GitHubCheckData,
  screenshotTest: ScreenshotTest,
  testResults: TestResult[],
  changeCount: number,
): Promise<void> {
  const hasChanges = changeCount > 0

  try {
    // Update GitHub check run "Visual Tests" with the build results
    const { title, summary, text } = createMarkdownForBuildResult(screenshotTest, testResults)
    await updateGitHubCheckRun({
      owner: githubCheckData.owner,
      repo: githubCheckData.repo,
      installationId: githubCheckData.installationId,
      checkRunId: githubCheckData.checkRunId,
      testId: screenshotTest.id,
      status: hasChanges ? "queued" : "completed",
      conclusion: hasChanges ? "action_required" : "success",
      title,
      summary,
      text,
      // Unfortunately, GitHub does not support actions for check runs that are queued
      // actions: hasChanges
      //   ? [
      //       {
      //         label: "✅ Approve",
      //         description: `Approve ${changeCount} visual change${changeCount === 1 ? "" : "s"}`,
      //         identifier: "approved",
      //       },
      //       {
      //         label: "❌ Deny",
      //         description: `Deny ${changeCount} visual change${changeCount === 1 ? "" : "s"}`,
      //         identifier: "denied",
      //       },
      //     ]
      //   : undefined,
    })
  } catch (error) {
    log.error(error, "Failed to update GitHub check run to completed")
    // Continue even if the GitHub API calls fail
  }
}

async function getS3BucketForProjectId(_projectId: string): Promise<string> {
  return S3_BUCKET_NAME
}
