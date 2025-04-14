import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import type { Capabilities } from "@wdio/types"
import { promises as fsPromises } from "node:fs"
import http from "node:http"
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
import { Stripe } from "stripe"
import { extract } from "tar"
import { Not, In } from "typeorm"
import { remote } from "webdriverio"

import { Database } from "./database"
import { downloadWithTimeout } from "./download"
import { APP_URL, STRIPE_SECRET_KEY } from "./environment"
import { getOctokitForInstallation, updateGitHubCheckRun, type GitHubCheckData } from "./github"
import { log } from "./log"
import { type Story, processStory } from "./stories"

type StorybookWindow = {
  __STORYBOOK_PREVIEW__?: {
    ready: boolean
    extract: () => Promise<Record<string, Story>>
    storyStore?: {
      cacheAllCSFFiles: () => Promise<void>
    }
  }
}

export async function ingestStorybook(
  projectId: string,
  screenshotTestId: number,
  uploadId: string,
  githubCheckData?: GitHubCheckData,
): Promise<void> {
  log.info(`Starting storybook ingestion for project ${projectId}, upload ${uploadId}`)

  // Fetch the screenshot test record
  const db = await Database()
  const screenshotTestRepo = db.getRepository(ScreenshotTest)
  const screenshotTest = await screenshotTestRepo.findOneBy({ id: screenshotTestId })
  if (!screenshotTest) {
    throw new Error(`Screenshot test not found: ${screenshotTestId}`)
  }

  // Update GitHub check run to in-progress if we have GitHub check data
  if (githubCheckData) {
    try {
      await updateGitHubCheckRun({
        owner: githubCheckData.owner,
        repo: githubCheckData.repo,
        installationId: githubCheckData.installationId,
        checkRunId: githubCheckData.checkRunId,
        testId: screenshotTestId,
        status: "in_progress",
        title: "Rendering storybook components…",
        summary: createSummaryForBuild(screenshotTest),
      })
    } catch (error) {
      log.error(error, "Failed to update GitHub check run to in-progress")
      // Continue with the ingest process even if the GitHub API call fails
    }
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
    log.info("Initializing WebdriverIO in headless Chrome mode")
    const config: Capabilities.WebdriverIOConfig = {
      outputDir: path.join(tmpDir, "wdio-logs"),
      hostname: "localhost",
      port: 4444,
      capabilities: {
        browserName: "chrome",
        "goog:chromeOptions": {
          args: ["--headless", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        },
      },
    }
    const browser = await remote(config)
    log.debug(
      `Successfully initialized WebdriverIO [${browser.capabilities.browserName}] ` +
        `[${browser.capabilities.browserVersion}] [${browser.capabilities.platformName}]`,
    )

    try {
      // Start a local server to serve the Storybook files
      log.info("Starting local HTTP server for Storybook files")
      const server = http.createServer((req, res) => {
        // Reject requests that try to access files outside of the served directory
        const requestedPath = path.normalize(req.url?.split("?")[0] ?? "")
        if (requestedPath.includes("..") || !requestedPath.startsWith("/")) {
          res.writeHead(403)
          res.end()
          return
        }

        const filePath = path.join(tmpDir, requestedPath)
        log.debug(`Serving file: ${filePath}`)
        fsPromises
          .readFile(filePath)
          .then((content) => {
            const ext = path.extname(filePath)
            const contentType =
              {
                ".html": "text/html",
                ".js": "text/javascript",
                ".css": "text/css",
                ".json": "application/json",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".gif": "image/gif",
                ".svg": "image/svg+xml",
              }[ext] ?? "application/octet-stream"

            res.writeHead(200, { "Content-Type": contentType })
            res.end(content)
            log.debug(`Successfully served file: ${filePath}`)
          })
          .catch(() => {
            log.warn(`File not found: ${filePath}`)
            res.writeHead(404)
            res.end()
          })
      })

      // Let the OS choose an available port
      server.listen(0)

      // Wait for the server to be ready
      await new Promise<void>((resolve) => {
        server.once("listening", () => resolve())
      })

      const address = server.address()
      if (!address || typeof address === "string") {
        throw new Error("Failed to get server port")
      }
      const port = address.port
      log.info(`Local server started on port ${port}`)

      try {
        // Set a fixed viewport
        await browser.setViewport({
          width: 1200,
          height: 900,
          devicePixelRatio: 1,
        })

        // Navigate to the Storybook iframe and wait for stories to load
        const timeoutMs = 10 * 1000 // 10 seconds
        log.info("Waiting for Storybook to load stories")
        await browser.url(`http://localhost:${port}/iframe.html`)
        await browser.waitUntil(
          async () => {
            return await browser.execute(async (): Promise<boolean> => {
              // @ts-expect-error: window is not defined
              // eslint-disable-next-line no-underscore-dangle
              const preview = (window as StorybookWindow).__STORYBOOK_PREVIEW__
              if (!preview?.storyStore) {
                return false
              }

              try {
                await preview.storyStore.cacheAllCSFFiles()
                return true
              } catch {
                return false
              }
            })
          },
          {
            timeout: timeoutMs,
            timeoutMsg: `Storybook failed to load stories within ${timeoutMs / 1000}s`,
            interval: 100,
          },
        )

        // Get the loaded stories
        const stories = await browser.execute(async () => {
          // @ts-expect-error: window is not defined
          // eslint-disable-next-line no-underscore-dangle
          const preview = (window as StorybookWindow).__STORYBOOK_PREVIEW__
          if (!preview) {
            return undefined
          }

          try {
            return await preview.extract()
          } catch (err) {
            console.error("Failed to extract stories:", err)
            return undefined
          }
        })
        if (!stories) {
          throw new Error("No stories found in Storybook")
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
        await screenshotTestRepo.save(screenshotTest)

        // Update GitHub check run "Visual Tests" with the build results
        if (githubCheckData) {
          await updateGitHubCheckRunWithBuildResults(
            githubCheckData,
            screenshotTest,
            testResults,
            changeCount,
          )
        }

        // Report screenshot usage to Stripe
        if (STRIPE_SECRET_KEY) {
          await reportScreenshotUsageToStripe(screenshotTest, testResults)
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

    // Update GitHub check run with failure if we have GitHub check data
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

      // Update GitHub check run with cancelled if we have GitHub check data
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
      status: "completed",
      conclusion: hasChanges ? "action_required" : "success",
      title,
      summary,
      text,
      actions: hasChanges
        ? [
            {
              label: "✅ Approve",
              description: `Approve ${changeCount} visual change${changeCount === 1 ? "" : "s"}`,
              identifier: "approved",
            },
            {
              label: "❌ Deny",
              description: `Deny ${changeCount} visual change${changeCount === 1 ? "" : "s"}`,
              identifier: "denied",
            },
          ]
        : undefined,
    })

    if (!hasChanges) {
      const { summary: approvalSummary } = createMarkdownForBuildResult(screenshotTest, testResults)
      // Create a new check run with the success conclusion
      const octokit = await getOctokitForInstallation(githubCheckData.installationId)
      const result = await octokit.checks.create({
        owner: githubCheckData.owner,
        repo: githubCheckData.repo,
        head_sha: screenshotTest.commitSha,
        external_id: String(screenshotTest.id),
        name: "Visual Tests",
        status: "completed",
        conclusion: "success",
        details_url: `${APP_URL}/build?id=${screenshotTest.id}`,
        output: {
          title: "No visual changes detected.",
          summary: approvalSummary,
        },
      })
      log.info(
        `Created GitHub check run ${result.data.id} for ${screenshotTest.toString()} with implicit conclusion: success`,
      )
    }
  } catch (error) {
    log.error(error, "Failed to update GitHub check run to completed")
    // Continue even if the GitHub API calls fail
  }
}

async function reportScreenshotUsageToStripe(
  screenshotTest: ScreenshotTest,
  testResults: TestResult[],
): Promise<void> {
  try {
    if (!STRIPE_SECRET_KEY) {
      log.warn("STRIPE_SECRET_KEY is not set, skipping usage reporting")
      return
    }

    // Get the user's Stripe customer ID from the project
    const user = screenshotTest.project.user
    if (!user.stripeCustomerId) {
      log.error(
        `User ${user.id} (${user.email}) has no Stripe customer ID, skipping usage reporting`,
      )
      return
    }

    // Count the number of screenshots to report
    const screenshotCount = testResults.length
    if (screenshotCount <= 0) {
      log.warn(`No screenshots to report for test ${screenshotTest.id}`)
      return
    }

    const idempotencyKey = `screenshot-usage-${screenshotTest.id}`

    const stripe = new Stripe(STRIPE_SECRET_KEY)
    await stripe.billing.meterEvents.create(
      {
        event_name: "screenshots",
        payload: {
          stripe_customer_id: user.stripeCustomerId,
          value: screenshotCount.toString(),
        },
        identifier: idempotencyKey,
      },
      { idempotencyKey },
    )

    log.info(
      {
        userId: user.id,
        projectId: screenshotTest.project.id,
        testId: screenshotTest.id,
        quantity: screenshotCount,
      },
      `Reported ${screenshotCount} screenshots to Stripe for user ${user.id} (${user.email})`,
    )
  } catch (error) {
    // Log the error but don't fail the entire test process
    log.error(error, `Failed to report usage to Stripe for test ${screenshotTest.id}`)
  }
}

async function getS3BucketForProjectId(_projectId: string): Promise<string> {
  return "vizdiffio-testing"
}
