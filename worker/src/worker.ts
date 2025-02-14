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

const TASKS_CHANNEL = "task_queue"
const CONN_STRING = `postgres://${POSTGRES_USER}:${POSTGRES_PASS}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}`
const POLL_INTERVAL_MS = 1000 * 10

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
// Pending tasks we were notified about or discovered while processing another task
const pendingTaskIds: number[] = []

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
    setTimeout(pollForNewTasks, POLL_INTERVAL_MS)
    return
  }

  latestTaskQueueId()
    .then((taskQueueId) => {
      if (taskQueueId == undefined) {
        setTimeout(pollForNewTasks, POLL_INTERVAL_MS)
        return
      }

      log.info(`Found new task: ${taskQueueId}`)
      startTask(taskQueueId)
        .catch((err: unknown) => {
          log.error(`Error processing task ${taskQueueId}: ${err}`)
        })
        .finally(() => {
          setTimeout(pollForNewTasks, 0)
        })
    })
    .catch((err: unknown) => {
      log.error("Error fetching latest task queue ID:", err)
      setTimeout(pollForNewTasks, POLL_INTERVAL_MS)
    })
}

export async function startTask(taskQueueId: number): Promise<void> {
  const task = await fetchTask(taskQueueId)
  if (!task) {
    log.warn(`Not starting task ${taskQueueId}: fetchTask() failed`)
    return
  }

  log.debug(`Fetched task ${taskQueueId} [${task.task_type}]`)

  if (currentTaskId != undefined) {
    log.info(`Cannot start task ${taskQueueId}: worker is already processing task ${currentTaskId}`)
    pendingTaskIds.push(taskQueueId)
    return
  }

  currentTaskId = taskQueueId
  await processTask(task.task_type, task.screenshot_test_id, task.data).finally(async () => {
    currentTaskId = undefined

    const nextTaskId = pendingTaskIds.shift()
    if (nextTaskId) {
      await startTask(nextTaskId)
    }
  })
}

export async function latestTaskQueueId(): Promise<number | undefined> {
  const client = await pool.connect()
  try {
    const res = await client.query("select id from task_queue order by id desc limit 1")
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
    // First try to acquire the lock atomically
    const lockRes = await client.query(
      `UPDATE task_queue 
       SET locked_at = NOW(), locked_by = $1
       WHERE id = $2 AND locked_at IS NULL
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
      log.warn(`Task ${taskQueueId} is locked by ${task.locked_by} since ${task.locked_at}`)
      return undefined
    }

    return lockRes.rows[0] as {
      task_type: string
      screenshot_test_id: number
      data: Record<string, unknown>
    }
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
        const { projectId, uploadId } = data as IngestStorybookPayload
        await ingestStorybook(projectId, screenshotTestId, uploadId)
        break
      }
      default:
        throw new Error(`Unknown task type: ${taskType}`)
    }
  } finally {
    // Make sure to release the lock even if there's an error
    if (currentTaskId) {
      await releaseLock(currentTaskId)
    }
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
    // Download the tarball from S3
    log.info(`Downloading storybook build from S3: ${key}`)
    const getObjectCommand = new GetObjectCommand({ Bucket: bucket, Key: key })
    const response = await s3Client.send(getObjectCommand)
    if (!response.Body) {
      throw new Error("Empty response body from S3")
    }
    log.debug(`Successfully downloaded storybook build from S3`)

    // Save the tarball to disk
    const tarballPath = path.join(tmpDir, "storybook.tar.gz")
    log.debug(`Saving tarball to: ${tarballPath}`)
    const writeStream = fs.createWriteStream(tarballPath)
    await new Promise<void>((resolve, reject) => {
      if (response.Body instanceof Readable) {
        const stream = response.Body.pipe(writeStream)
        stream.on("finish", () => resolve())
        stream.on("error", (err: Error) => reject(err))
      } else {
        reject(new Error("Response body is not a readable stream"))
      }
    })
    log.debug(`Successfully saved tarball to disk`)

    // Extract the tarball
    log.info(`Extracting storybook build to: ${tmpDir}`)
    await extract({ file: tarballPath, cwd: tmpDir })
    log.debug(`Successfully extracted storybook build`)

    // Initialize WebdriverIO
    log.info("Initializing WebdriverIO in headless Chrome mode")
    const config: Capabilities.WebdriverIOConfig = {
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
        const requestedPath = path.normalize(req.url ?? "")
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
      const address = server.address()
      if (!address || typeof address === "string") {
        throw new Error("Failed to get server port")
      }
      const port = address.port
      log.info(`Local server started on port ${port}`)

      try {
        // Read the Storybook preview file to get the list of stories
        log.info("Reading Storybook preview file to extract stories")
        const previewFile = await fsPromises.readFile(path.join(tmpDir, "iframe.html"), "utf8")
        const storiesMatch = /window\['STORIES'\] = ({.*?});/s.exec(previewFile)
        const storiesJson = storiesMatch?.at(1)
        if (!storiesJson) {
          throw new Error("Could not find stories in preview file")
        }
        log.debug("Successfully extracted stories from preview file")

        const stories = JSON.parse(storiesJson) as Record<string, Story>
        log.info(`Found ${Object.keys(stories).length} stories to process`)

        const testResultTable = db.getRepository(TestResult)

        // Fetch test results from the base commit if it exists
        const baseTestResults = new Map<string, TestResult>()
        if (screenshotTest.baseCommitSha) {
          log.info(`Fetching base test results for commit ${screenshotTest.baseCommitSha}`)
          const baseTests = await testResultTable
            .createQueryBuilder("result")
            .innerJoin(ScreenshotTest, "test", "result.screenshotTestId = test.id")
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
                baseTestResult: baseTestResults.get(story.id),
                bucket,
                tmpDir,
                projectId,
                uploadId,
                port,
                s3Client,
                testResultTable,
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
        server.close()
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
    await client.query("UPDATE task_queue SET locked_at = NULL, locked_by = NULL WHERE id = $1", [
      taskQueueId,
    ])
  } finally {
    client.release()
  }
}

main().catch((err: unknown) => {
  log.error(`Fatal error: ${err}`)
})
