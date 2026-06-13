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
import { Not, In } from "typeorm"
import { remote } from "webdriverio"

import { Database } from "./database"
import { downloadWithTimeout } from "./download"
import {
  BUILD_ABORT_GRACE_MS,
  BUILD_MEMORY_WARN_BYTES,
  BUILD_TIMEOUT_MS,
  IS_PRODUCTION,
  MAX_STORIES_PER_UPLOAD,
  S3_BUCKET_NAME,
  S3_CLIENT_CONFIG,
  WORKER_STORY_CONCURRENCY,
} from "./environment"
import { safeExtract } from "./extract"
import { updateGitHubCheckRun, type GitHubCheckData } from "./github"
import { getGitLabHostConfig, updateGitLabCommitStatus, type GitLabCheckData } from "./gitlab"
import { log } from "./log"
import { buildImageUrlResolver } from "./s3"
import { startStaticServer } from "./server"
import { getStorybookStories, navigateToStorybook, processStory } from "./stories"
import { NonRetryableTaskError, isPermanentS3FetchError } from "./tasks"
import { withTimeout } from "./timeout"

/** Log resident set size, warning when it crosses the configured threshold. */
function logBuildMemoryUsage(phase: string, screenshotTestId: number): void {
  const { rss, heapUsed } = process.memoryUsage()
  const ctx = { phase, screenshotTestId, rssBytes: rss, heapUsedBytes: heapUsed }
  if (rss >= BUILD_MEMORY_WARN_BYTES) {
    log.warn(ctx, `High memory usage during build (RSS ${(rss / 1024 / 1024).toFixed(0)} MiB)`)
  } else {
    log.debug(ctx, `Build memory usage (RSS ${(rss / 1024 / 1024).toFixed(0)} MiB)`)
  }
}

/**
 * Determine whether the baseline build that a render task depends on is still
 * being processed (or waiting to be processed).
 *
 * When two commits A then B land on the same branch, B's `baseCommitSha` points
 * at A. If B's render task runs before A's has finished writing `TestResult`s, B
 * would fetch an empty baseline and flag every story as "new". This helper lets
 * the worker detect that situation and defer B until A is done.
 *
 * Returns true if a `ScreenshotTest` exists for `(projectId, commitSha=baseCommitSha)`
 * whose status is still `pending` or `running` (i.e. its render task hasn't
 * produced final results yet). Returns false if the test has no base commit,
 * if there is no such build, or if every matching build has reached a terminal
 * status (results are ready, the baseline genuinely has no build, or it
 * failed) — in which case we should proceed rather than wait forever.
 */
export async function isBaselineBuildPending(screenshotTestId: number): Promise<boolean> {
  const db = await Database()
  const screenshotTestRepo = db.getRepository(ScreenshotTest)

  const screenshotTest = await screenshotTestRepo.findOneBy({ id: screenshotTestId })
  if (!screenshotTest) {
    throw new Error(`Screenshot test not found: ${screenshotTestId}`)
  }

  const baseCommitSha = screenshotTest.baseCommitSha
  if (!baseCommitSha) {
    return false
  }
  const projectId = screenshotTest.project.id

  // A build is "in flight" while it is queued (pending) or rendering (running).
  // Any other status is terminal for our purposes: no_changes / unapproved /
  // approved / denied all mean results exist; failed means it will never produce
  // results, so we must not block on it.
  const inFlightCount = await screenshotTestRepo
    .createQueryBuilder("test")
    .where("test.project_id = :projectId", { projectId })
    .andWhere("test.commit_sha = :baseCommitSha", { baseCommitSha })
    .andWhere("test.status IN (:...statuses)", { statuses: ["pending", "running"] })
    // Exclude the current test itself defensively (it should never share the
    // base commit sha, but guard against self-blocking just in case).
    .andWhere("test.id != :screenshotTestId", { screenshotTestId })
    .getCount()

  return inFlightCount > 0
}

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
  const s3Client = new S3Client(S3_CLIENT_CONFIG)
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
    let response
    try {
      response = await s3Client.send(getObjectCommand)
    } catch (error) {
      // If the upload tarball is permanently gone (e.g. NoSuchKey) there is no
      // point retrying. Surface it as a non-retryable error so the worker deletes
      // the task from the queue instead of releasing the lock for backoff retries.
      // The outer catch below marks the ScreenshotTest as failed before this
      // propagates.
      if (isPermanentS3FetchError(error)) {
        const name = (error as { name?: string }).name ?? "unknown"
        throw new NonRetryableTaskError(
          `Storybook upload tarball is unavailable (${name}) at s3://${bucket}/${key}; not retrying`,
          error,
        )
      }
      throw error
    }
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
    await safeExtract(tarballPath, tmpDir)
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

    logBuildMemoryUsage("render-start", screenshotTest.id)

    const renderStorybook = async (): Promise<void> => {
      // Start a local server to serve the Storybook files
      const { server, port } = await startStaticServer(tmpDir)

      try {
        // Set the initial viewport
        await browser.setViewport({ width: 1200, height: 900, devicePixelRatio: 1 })

        // Navigate to the Storybook iframe and wait for stories to load
        await navigateToStorybook(browser, port)

        // Get the loaded stories (validated: identifier length caps applied per story)
        const stories = await getStorybookStories(browser)

        const storyCount = Object.keys(stories).length
        if (storyCount === 0) {
          throw new Error("Storybook loaded but contains no stories")
        }

        // Guard against pathological uploads with a runaway number of stories.
        if (MAX_STORIES_PER_UPLOAD > 0 && storyCount > MAX_STORIES_PER_UPLOAD) {
          throw new Error(
            `Storybook contains too many stories: ${storyCount} (max ${MAX_STORIES_PER_UPLOAD}). ` +
              `Set MAX_STORIES_PER_UPLOAD to raise this limit.`,
          )
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

        // Process stories with a configurable concurrency limit (issue #152, Phase 1).
        // Defaults to 1 (sequential). Browser navigation/stabilization is currently serialized by
        // the process-wide mutex in captureStableScreenshot, so values > 1 only overlap the S3
        // diff/upload portions until that mutex is removed in a later increment.
        const limit = pLimit(WORKER_STORY_CONCURRENCY)
        log.info(`Rendering stories with concurrency limit ${WORKER_STORY_CONCURRENCY}`)
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
    }

    try {
      // Wrap the entire render phase in a max-duration guard. A build that exceeds this is
      // almost always stuck or pathologically large; on timeout we force-close the browser
      // session so the in-flight WebDriver commands reject and the stack unwinds. Crucially,
      // withTimeout then waits for renderStorybook() to actually settle before surfacing the
      // BuildTimeoutError — its `finally` blocks (and the per-story `finally` that releases the
      // module-level browserMutex in stories.ts) must run before the worker is freed to accept a
      // new build, otherwise the next build would block on a poisoned mutex and time out too.
      // If the render fails to unwind within the grace period, the session is wedged beyond
      // in-process recovery, so withTimeout exits the worker (default onUnrecoverable) and the
      // orchestrator restarts a clean process. BuildTimeoutError is treated as a non-retryable
      // failure by the task scheduler.
      await withTimeout(
        renderStorybook(),
        BUILD_TIMEOUT_MS,
        () => {
          log.warn(
            `Build ${screenshotTest.id} (#${screenshotTest.buildNumber}) exceeded ${BUILD_TIMEOUT_MS}ms; aborting and closing browser session`,
          )
          return browser.deleteSession().catch((err: unknown) => {
            log.warn(err, "Failed to close browser session during build-timeout abort")
          })
        },
        {
          abortGraceMs: BUILD_ABORT_GRACE_MS,
          onUnrecoverable: (err) => {
            log.fatal(
              err,
              `Build ${screenshotTest.id} (#${screenshotTest.buildNumber}) did not unwind within ` +
                `${BUILD_ABORT_GRACE_MS}ms after abort; the render is wedged (likely holding ` +
                `browserMutex). Exiting worker so the orchestrator restarts a clean process.`,
            )
            process.exit(1)
          },
        },
      )
    } finally {
      log.debug("Closing WebdriverIO browser session")
      // The session may already be gone if a timeout abort closed it; tolerate that so we
      // never mask the original error with a teardown failure.
      await browser.deleteSession().catch((err: unknown) => {
        log.debug(err, "browser.deleteSession() during cleanup (may already be closed)")
      })
      logBuildMemoryUsage("render-end", screenshotTest.id)
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
    const resolveImageUrl = await buildImageUrlResolver(testResults)
    const { title, summary, text } = createMarkdownForBuildResult(
      screenshotTest,
      testResults,
      resolveImageUrl,
    )
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
