/* eslint-disable no-underscore-dangle */
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import type { Capabilities } from "@wdio/types"
import fs, { promises as fsPromises } from "node:fs"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import { Readable } from "node:stream"
import pLimit from "p-limit"
import pg from "pg"
import createPgSubscriber from "pg-listen"
import { ScreenshotTest, TestResult } from "shared"
import { extract } from "tar"
import { Not, In } from "typeorm"
import { remote } from "webdriverio"

import { Database } from "./database"
import {
  POSTGRES_USER,
  POSTGRES_HOST,
  POSTGRES_DATABASE,
  POSTGRES_PASS,
  POSTGRES_PORT,
} from "./environment"
import { log } from "./log"
import { processStory } from "./stories"

type IngestStorybookPayload = {
  projectId: string
  uploadId: string
}

type Task = {
  task_type: string
  screenshot_test_id: number
  data: Record<string, unknown>
}

interface Story {
  id: string
  name: string
  importPath: string
}

type StorybookWindow = {
  __STORYBOOK_PREVIEW__?: {
    ready: boolean
    extract: () => Promise<Record<string, Story>>
    storyStore?: {
      cacheAllCSFFiles: () => Promise<void>
    }
  }
}

const TASKS_CHANNEL = "task_queue"
const CONN_STRING = `postgres://${POSTGRES_USER}:${POSTGRES_PASS}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}`
const POLL_INTERVAL_MS = 1000 * 10
const RETRY_INTERVAL_MS = 1000 * 15
const LOCK_TIMEOUT_MINUTES = 60
const MAX_RETRY_COUNT = 5 // Maximum number of retries before giving up
const MAX_BACKOFF_MS = 1000 * 60 * 30 // 30 minutes max backoff
// Consider a build stuck if it's been running for more than this amount of time
const STUCK_RUNNING_THRESHOLD_MINUTES = 120 // 2 hours
// Consider a build stuck if it's been pending for more than this amount of time
const STUCK_PENDING_THRESHOLD_MINUTES = 240 // 4 hours

// Postgres connection pool, used for raw SQL queries such as acquiring locks
const pool = new pg.Pool({
  host: POSTGRES_HOST,
  user: POSTGRES_USER,
  password: POSTGRES_PASS,
  database: POSTGRES_DATABASE,
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})
// Postgres notification listener
const subscriber = createPgSubscriber({ connectionString: CONN_STRING })
// Current task being processed, if any
let currentTaskId: number | undefined
// Map of task IDs to their failure count and next retry time
const failedTasksMap = new Map<number, { retryCount: number; nextRetryTime: number }>()

// Clear failed task ID after it's been retried the maximum number of times or after successful processing
function clearFailedTaskId(taskId: number): void {
  failedTasksMap.delete(taskId)
}

async function main() {
  subscriber.notifications.on(TASKS_CHANNEL, (payload) => {
    log.info(`Received notification in '${TASKS_CHANNEL}':`, payload)
    if (typeof payload !== "string" && typeof payload !== "number") {
      log.error("Invalid payload type", typeof payload)
      return
    }

    const taskQueueId = typeof payload === "string" ? parseInt(payload, 10) : payload
    if (isNaN(taskQueueId)) {
      log.error("Invalid task queue ID:", payload)
      return
    }

    startTask(taskQueueId).catch((err: unknown) => log.error("Error processing task:", err))
  })

  subscriber.events.on("error", (error) => {
    log.error("Fatal database connection error:", error)
    process.exit(1)
  })

  process.on("exit", shutdown)

  await subscriber.connect()
  await subscriber.listenTo(TASKS_CHANNEL)

  log.info("Starting worker poll")
  pollForNewTasks()
}

export function pollForNewTasks(): void {
  // Early return if we're already processing a task
  if (currentTaskId != undefined) {
    log.debug("Worker is busy, skipping poll")
    setTimeout(() => pollForNewTasks(), POLL_INTERVAL_MS)
    return
  }

  latestTaskQueueId()
    .then((taskQueueId) => {
      if (taskQueueId == undefined) {
        log.trace(`No new tasks, checking for stuck builds...`)
        // No tasks, so check for stuck builds
        sweepStuckBuilds()
          .then((stuckBuildsCount) => {
            if (stuckBuildsCount > 0) {
              log.info(`Found and updated ${stuckBuildsCount} stuck builds`)
            } else {
              log.trace(`No stuck builds found`)
            }
            setTimeout(() => pollForNewTasks(), POLL_INTERVAL_MS)
          })
          .catch((err: unknown) => {
            log.error(`Error sweeping for stuck builds: ${err}`)
            setTimeout(() => pollForNewTasks(), POLL_INTERVAL_MS)
          })
        return
      }

      // Check if this task has a backoff period
      const now = Date.now()
      const failedTask = failedTasksMap.get(taskQueueId)

      // Skip if this task's next retry time hasn't been reached
      if (failedTask && now < failedTask.nextRetryTime) {
        const waitTimeSec = Math.round((failedTask.nextRetryTime - now) / 1000)
        log.debug(`Skipping recently failed task ${taskQueueId}, will retry in ${waitTimeSec}s`)

        // If a task has failed many times but is still in the queue, it might be stuck
        if (failedTask.retryCount >= 3) {
          log.warn(
            `Task ${taskQueueId} has failed ${failedTask.retryCount} times but is still in the queue. Consider manually deleting it.`,
          )
        }

        setTimeout(() => pollForNewTasks(), POLL_INTERVAL_MS)
        return
      }

      log.info(`Found new task: ${taskQueueId}`)
      startTask(taskQueueId)
        .then(() => {
          // Task was processed successfully, immediately check for more tasks
          // Use process.nextTick to avoid growing the stack too much with synchronous tasks
          log.debug("Task completed successfully, immediately checking for more tasks")
          process.nextTick(() => pollForNewTasks())
        })
        .catch((err: unknown) => {
          log.error(`Error processing task ${taskQueueId}: ${err}`)

          // Update retry count and calculate next retry with exponential backoff
          const taskFailureInfo = failedTasksMap.get(taskQueueId) ?? {
            retryCount: 0,
            nextRetryTime: 0,
          }
          taskFailureInfo.retryCount += 1

          if (taskFailureInfo.retryCount > MAX_RETRY_COUNT) {
            log.error(
              `Task ${taskQueueId} has failed ${taskFailureInfo.retryCount} times, giving up`,
            )
            clearFailedTaskId(taskQueueId)
          } else {
            // Calculate exponential backoff: 2^retryCount * base interval, with a maximum cap
            const backoffMs = Math.min(
              Math.pow(2, taskFailureInfo.retryCount) * RETRY_INTERVAL_MS,
              MAX_BACKOFF_MS,
            )
            taskFailureInfo.nextRetryTime = now + backoffMs
            failedTasksMap.set(taskQueueId, taskFailureInfo)

            const backoffSec = Math.round(backoffMs / 1000)
            log.info(
              `Task ${taskQueueId} failed ${taskFailureInfo.retryCount} times, will retry in ${backoffSec}s`,
            )
          }

          // For failures, use the normal poll interval
          setTimeout(() => pollForNewTasks(), POLL_INTERVAL_MS)
        })
    })
    .catch((err: unknown) => {
      log.error("Error fetching latest task queue ID:", err)
      setTimeout(() => pollForNewTasks(), POLL_INTERVAL_MS)
    })
}

export async function startTask(taskQueueId: number): Promise<void> {
  // Check if we're already processing a task
  if (currentTaskId != undefined) {
    log.info(`Cannot start task ${taskQueueId}: worker is already processing task ${currentTaskId}`)
    return
  }
  currentTaskId = taskQueueId

  try {
    const task = await fetchTask(taskQueueId)
    if (!task) {
      log.warn(`Not starting task ${taskQueueId}: fetchTask() failed`)
      currentTaskId = undefined
      return
    }

    log.debug(`Fetched task ${taskQueueId} [${task.task_type}]`)
    await processTask(task.task_type, task.screenshot_test_id, task.data)

    // If we got here, the task was successful, so clear it from the failed tasks map
    clearFailedTaskId(taskQueueId)
  } catch (error) {
    log.error(`Error processing task ${taskQueueId}:`, error)
    throw error
  } finally {
    currentTaskId = undefined
  }
}

export async function latestTaskQueueId(): Promise<number | undefined> {
  const client = await pool.connect()
  try {
    const res = await client.query(
      `SELECT id FROM task_queue 
       WHERE locked_at IS NULL 
          OR locked_at < NOW() - INTERVAL '${LOCK_TIMEOUT_MINUTES} minutes'
       ORDER BY id DESC 
       LIMIT 1`,
    )
    if (res.rowCount === 0) {
      return undefined
    }
    return (res.rows[0] as { id: number }).id
  } finally {
    client.release()
  }
}

export async function fetchTask(taskQueueId: number): Promise<Task | undefined> {
  const client = await pool.connect()
  try {
    // First try to acquire the lock atomically, respecting the lock timeout
    const lockRes = await client.query(
      `UPDATE task_queue 
       SET locked_at = NOW(), locked_by = $1
       WHERE id = $2 
         AND (locked_at IS NULL 
           OR locked_at < NOW() - INTERVAL '${LOCK_TIMEOUT_MINUTES} minutes')
       RETURNING task_type, screenshot_test_id, data`,
      [`worker-${process.pid}`, taskQueueId],
    )

    // If no rows were updated, the task was already locked or doesn't exist
    if (lockRes.rowCount === 0) {
      const checkRes = await client.query(
        "SELECT locked_at, locked_by FROM task_queue WHERE id = $1",
        [taskQueueId],
      )
      if (checkRes.rowCount === 0) {
        throw new Error(`Task not found: ${taskQueueId}`)
      }
      const task = checkRes.rows[0] as { locked_by: string; locked_at: Date }
      const lockAge = Math.floor((Date.now() - task.locked_at.getTime()) / (1000 * 60))
      log.warn(
        `Task ${taskQueueId} is locked by ${task.locked_by} since ${task.locked_at} (${lockAge} minutes ago)`,
      )
      return undefined
    }

    const task = lockRes.rows[0] as {
      task_type: string
      screenshot_test_id: number
      data: Record<string, unknown> | string | undefined
    }

    if (!task.data) {
      throw new Error(`Task ${taskQueueId} has no data`)
    } else if (typeof task.data === "string") {
      log.warn(`Task ${taskQueueId} has string data, parsing as JSON`)
      task.data = JSON.parse(task.data) as Record<string, unknown>
    }

    return task as Task
  } finally {
    client.release()
  }
}

export async function processTask(
  taskType: string,
  screenshotTestId: number,
  data: Record<string, unknown>,
): Promise<void> {
  log.info(`Processing task: [${taskType}] ${JSON.stringify(data)}`)
  try {
    switch (taskType) {
      case "ingest_storybook": {
        const { projectId, uploadId } = data as Partial<IngestStorybookPayload>
        if (!projectId || !uploadId) {
          throw new Error(
            `Missing required ingest_storybook fields: projectId=${projectId}, uploadId=${uploadId}`,
          )
        }
        await ingestStorybook(projectId, screenshotTestId, uploadId)

        // Task completed successfully, delete it from the queue
        if (currentTaskId) {
          await deleteTask(currentTaskId)
        }
        break
      }
      default:
        throw new Error(`Unknown task type: ${taskType}`)
    }
  } catch (error) {
    // On error, release the lock so it can be retried with backoff
    if (currentTaskId) {
      await releaseLock(currentTaskId)
    }
    throw error
  }
}

export function shutdown(): void {
  subscriber.close().catch((err: unknown) => {
    log.error("Error during shutdown:", err)
    process.exit(1)
  })
}

async function getS3BucketForProjectId(_projectId: string): Promise<string> {
  return "vizdiffio-testing"
}

export async function ingestStorybook(
  projectId: string,
  screenshotTestId: number,
  uploadId: string,
): Promise<void> {
  log.info(`Starting storybook ingestion for project ${projectId}, upload ${uploadId}`)

  // Fetch the screenshot test record
  const db = await Database()
  const screenshotTestRepo = db.getRepository(ScreenshotTest)
  const screenshotTest = await screenshotTestRepo.findOneBy({ id: screenshotTestId })
  if (!screenshotTest) {
    throw new Error(`Screenshot test not found: ${screenshotTestId}`)
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
        // Navigate to the Storybook iframe and wait for stories to load
        const timeoutMs = 10 * 1000 // 10 seconds
        log.info("Waiting for Storybook to load stories")
        await browser.url(`http://localhost:${port}/iframe.html`)
        await browser.waitUntil(
          async () => {
            return await browser.execute(async (): Promise<boolean> => {
              // @ts-expect-error: window is not defined
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
            .innerJoin(ScreenshotTest, "test", "result.screenshot_test_id = test.id")
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
        log.info(`Successfully processed all ${Object.keys(stories).length} stories`)

        let noChanges = true
        for (const testResult of testResults) {
          if (testResult.changeStatus !== "unchanged") {
            noChanges = false
            break
          }
        }

        // Update the screenshot test status to completed
        const startedSec = screenshotTest.createdAt.getTime() / 1000
        screenshotTest.status = noChanges ? "no_changes" : "unapproved"
        screenshotTest.buildDurationSec = Date.now() / 1000 - startedSec
        await screenshotTestRepo.save(screenshotTest)
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
      `Failed to process storybook: ${error instanceof Error ? error.message : String(error)}`,
    )
    screenshotTest.status = "failed"
    await screenshotTestRepo.save(screenshotTest)
    throw error
  } finally {
    // Cleanup
    log.debug(`Cleaning up temporary directory: ${tmpDir}`)
    await fsPromises.rm(tmpDir, { recursive: true, force: true })

    // If status is still "running", something went wrong without throwing an error
    if (screenshotTest.status === "running") {
      screenshotTest.status = "failed"
      await screenshotTestRepo.save(screenshotTest)
    }

    log.info(`Storybook ingestion completed with status: ${screenshotTest.status}`)
  }
}

export async function releaseLock(taskQueueId: number): Promise<void> {
  const client = await pool.connect()
  try {
    log.debug(`Releasing lock for task ${taskQueueId}`)
    await client.query("UPDATE task_queue SET locked_at = NULL, locked_by = NULL WHERE id = $1", [
      taskQueueId,
    ])
  } finally {
    client.release()
  }
}

/**
 * Delete a task from the queue after it's been successfully processed.
 */
export async function deleteTask(taskQueueId: number): Promise<void> {
  const client = await pool.connect()
  try {
    log.debug(`Deleting task ${taskQueueId} from queue`)
    await client.query("DELETE FROM task_queue WHERE id = $1", [taskQueueId])
  } finally {
    client.release()
  }
}

async function downloadWithTimeout(
  readable: Readable,
  destPath: string,
  timeoutMs: number,
): Promise<void> {
  const writeStream = fs.createWriteStream(destPath)
  const cleanup = () => {
    readable.destroy()
    writeStream.destroy()
  }

  await Promise.race([
    new Promise<void>((resolve, reject) => {
      const stream = readable.pipe(writeStream)
      stream.on("finish", () => resolve())
      stream.on("error", (err: Error) => {
        cleanup()
        reject(err)
      })
    }),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        cleanup()
        reject(new Error(`Download timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    }),
  ])
}

/**
 * Checks for screenshot tests that have been in "running" or "pending" status for too long
 * and marks them as "failed".
 *
 * @returns Promise with the number of stuck builds that were updated
 */
export async function sweepStuckBuilds(): Promise<number> {
  log.trace(
    `Sweeping for stuck builds (running threshold: ${STUCK_RUNNING_THRESHOLD_MINUTES} minutes, pending threshold: ${STUCK_PENDING_THRESHOLD_MINUTES} minutes)`,
  )

  try {
    const db = await Database()
    const screenshotTestRepo = db.getRepository(ScreenshotTest)

    // Calculate threshold dates for running and pending builds
    const runningThresholdDate = new Date()
    runningThresholdDate.setMinutes(
      runningThresholdDate.getMinutes() - STUCK_RUNNING_THRESHOLD_MINUTES,
    )

    const pendingThresholdDate = new Date()
    pendingThresholdDate.setMinutes(
      pendingThresholdDate.getMinutes() - STUCK_PENDING_THRESHOLD_MINUTES,
    )

    // Find stuck "running" builds
    const stuckRunningBuilds = await screenshotTestRepo
      .createQueryBuilder("test")
      .where("test.status = :status", { status: "running" })
      .andWhere("test.updated_at < :thresholdDate", { thresholdDate: runningThresholdDate })
      .getMany()

    // Find stuck "pending" builds
    const stuckPendingBuilds = await screenshotTestRepo
      .createQueryBuilder("test")
      .where("test.status = :status", { status: "pending" })
      .andWhere("test.updated_at < :thresholdDate", { thresholdDate: pendingThresholdDate })
      .getMany()

    // Combine both lists
    const stuckBuilds = [...stuckRunningBuilds, ...stuckPendingBuilds]

    if (stuckBuilds.length === 0) {
      return 0
    }

    // Update stuck builds to "failed" status
    log.info(
      `Found ${stuckBuilds.length} stuck builds to update (${stuckRunningBuilds.length} running, ${stuckPendingBuilds.length} pending)`,
    )

    for (const build of stuckBuilds) {
      const runningDurationHours = (Date.now() - build.updatedAt.getTime()) / (1000 * 60 * 60)
      log.warn(
        `Marking stuck build ${build.id} as failed (stuck in "${build.status}" for ${runningDurationHours.toFixed(1)} hours)`,
      )

      build.status = "failed"
      await screenshotTestRepo.save(build)
    }

    return stuckBuilds.length
  } catch (error) {
    log.error(`Error while sweeping for stuck builds: ${error}`)
    throw error
  }
}

main().catch((err: unknown) => {
  log.error(`Fatal error: ${err}`)
})
