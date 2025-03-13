import createPgSubscriber from "pg-listen"
import { ScreenshotTest } from "shared"

import { Database, DatabasePool } from "./database"
import {
  POSTGRES_USER,
  POSTGRES_HOST,
  POSTGRES_DATABASE,
  POSTGRES_PASS,
  POSTGRES_PORT,
} from "./environment"
import type { GitHubCheckData } from "./github"
import { ingestStorybook } from "./ingest"
import { log } from "./log"
import { latestTaskQueueId, fetchTask } from "./tasks"

type IngestStorybookPayload = {
  projectId: string
  uploadId: string
  githubCheckData?: GitHubCheckData
}

const TASKS_CHANNEL = "task_queue"
const CONN_STRING = `postgres://${POSTGRES_USER}:${POSTGRES_PASS}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}`
const POLL_INTERVAL_MS = 1000 * 10
const RETRY_INTERVAL_MS = 1000 * 15

const MAX_RETRY_COUNT = 5 // Maximum number of retries before giving up
const MAX_BACKOFF_MS = 1000 * 60 * 30 // 30 minutes max backoff
// Consider a build stuck if it's been running for more than this amount of time
const STUCK_RUNNING_THRESHOLD_MINUTES = 120 // 2 hours
// Consider a build stuck if it's been pending for more than this amount of time
const STUCK_PENDING_THRESHOLD_MINUTES = 240 // 4 hours

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

export async function processTask(
  taskType: string,
  screenshotTestId: number,
  data: Record<string, unknown>,
): Promise<void> {
  log.info(`Processing task: [${taskType}] ${JSON.stringify(data)}`)
  try {
    switch (taskType) {
      case "ingest_storybook": {
        const { projectId, uploadId, githubCheckData } = data as Partial<IngestStorybookPayload>
        if (!projectId || !uploadId) {
          throw new Error(
            `Missing required ingest_storybook fields: projectId=${projectId}, uploadId=${uploadId}`,
          )
        }
        await ingestStorybook(projectId, screenshotTestId, uploadId, githubCheckData)

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

export async function releaseLock(taskQueueId: number): Promise<void> {
  const client = await DatabasePool()
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
  const client = await DatabasePool()
  try {
    log.debug(`Deleting task ${taskQueueId} from queue`)
    await client.query("DELETE FROM task_queue WHERE id = $1", [taskQueueId])
  } finally {
    client.release()
  }
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

// Entry point
main().catch((err: unknown) => {
  log.error(`Fatal error: ${err}`)
})
