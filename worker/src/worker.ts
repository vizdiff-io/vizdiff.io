import "./datadog"
import createPgSubscriber from "pg-listen"
import { ScreenshotTest } from "shared"

import { Database, DatabasePool } from "./database"
import {
  POSTGRES_USER,
  POSTGRES_HOST,
  POSTGRES_DATABASE,
  POSTGRES_PASS,
  POSTGRES_PORT,
  IS_TEST,
} from "./environment"
import type { GitHubCheckData } from "./github"
import type { GitLabCheckData } from "./gitlab"
import { markTaskFinished, markTaskStarted, startHealthServer } from "./health"
import { ingestStorybook, isBaselineBuildPending } from "./ingest"
import { log } from "./log"
import {
  latestTaskQueueId,
  fetchTask,
  NonRetryableTaskError,
  DependencyNotReadyError,
} from "./tasks"
import { BuildTimeoutError } from "./timeout"

type IngestStorybookPayload = {
  projectId: string
  uploadId: string
  githubCheckData?: GitHubCheckData
  gitlabCheckData?: GitLabCheckData
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

// How long to defer a render task each time its dependent (baseline) build is
// still pending/in-progress, before re-checking. This is the length of the
// exclusion window: the deferred task stays excluded from selection until
// `nextRetryTime = deferStart + DEFER_INTERVAL_MS`.
const DEFER_INTERVAL_MS = 1000 * 5 // 5 seconds
// How long to wait before re-polling after a deferral. This MUST be strictly
// less than DEFER_INTERVAL_MS so that when the worker re-polls, the deferred
// task is still inside its exclusion window (now < nextRetryTime) and therefore
// still excluded from selection. That guarantees the older dependency (lower id)
// is the only eligible candidate at the re-poll and gets picked next — without
// this gap, the re-poll fires exactly at nextRetryTime, the deferred (newer,
// higher-id) task is no longer excluded, and descending-id selection re-picks it
// instead of the dependency.
const DEFER_REPOLL_MS = 1000 * 2 // 2 seconds
// Maximum number of times a task may be deferred for an unfinished dependency
// before we give up waiting and process it anyway. This bounds the wait and
// guarantees forward progress (avoids livelock) if the dependent never finishes.
// 60 defers * 5s ≈ 5 minutes of waiting.
const MAX_DEFER_COUNT = 60

// Postgres notification listener
const subscriber = createPgSubscriber({ connectionString: CONN_STRING })
// Current task being processed, if any
let currentTaskId: number | undefined
// Map of task IDs to their failure count and next retry time
const failedTasksMap = new Map<number, { retryCount: number; nextRetryTime: number }>()
// Map of task IDs that are deferred waiting on a dependent (baseline) build,
// to their defer count and the time at which they may be retried.
const deferredTasksMap = new Map<number, { deferCount: number; nextRetryTime: number }>()

// Clear failed task ID after it's been retried the maximum number of times or after successful processing
function clearFailedTaskId(taskId: number): void {
  failedTasksMap.delete(taskId)
}

// Clear a task's deferral state once it has been processed (or given up on).
function clearDeferredTaskId(taskId: number): void {
  deferredTasksMap.delete(taskId)
}

// Set of task ids that are currently deferred and not yet due for retry. These
// are excluded from task selection so the worker can pick the dependent build
// (typically an older, lower-id task) instead of re-selecting the deferred one.
//
// The exclusion window is [deferStart, nextRetryTime). Because the post-deferral
// re-poll is scheduled at DEFER_REPOLL_MS < DEFER_INTERVAL_MS (i.e. strictly
// before nextRetryTime), the deferred task is guaranteed to still be excluded at
// that re-poll, leaving the older dependency as the only eligible candidate.
function activeDeferredTaskIds(now: number): Set<number> {
  const ids = new Set<number>()
  for (const [taskId, info] of deferredTasksMap) {
    if (now < info.nextRetryTime) {
      ids.add(taskId)
    }
  }
  return ids
}

async function main() {
  startHealthServer()

  subscriber.notifications.on(TASKS_CHANNEL, (payload) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- pg-listen payload is untyped
    log.info(`Received notification in '${TASKS_CHANNEL}':`, payload)
    if (typeof payload !== "string" && typeof payload !== "number") {
      log.error(`Invalid payload type: ${typeof payload}`)
      return
    }

    const taskQueueId = typeof payload === "string" ? parseInt(payload, 10) : payload
    if (isNaN(taskQueueId)) {
      log.error(`Invalid task queue ID: ${payload}`)
      return
    }

    startTask(taskQueueId).catch((err: unknown) => log.error(err, "Error processing task"))
  })

  subscriber.events.on("error", (error) => {
    if (error instanceof AggregateError) {
      for (const err of error.errors) {
        log.error(err, "Database subscriber aggregate error")
      }
    } else {
      log.error(error, "Database subscriber error")
    }
    log.fatal("Exiting worker due to database subscriber error(s)")
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

  // Exclude tasks that are deferred waiting on a dependent build so the worker
  // can pick the dependent (typically older) task instead of looping on the
  // deferred one.
  const excludeIds = activeDeferredTaskIds(Date.now())

  latestTaskQueueId(excludeIds)
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
            log.error(err, "Error sweeping for stuck builds")
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
          clearDeferredTaskId(taskQueueId)
          process.nextTick(() => pollForNewTasks())
        })
        .catch((err: unknown) => {
          // A dependent (baseline) build is still pending/in-progress. Defer this
          // task for a short delay and let the worker pick the dependent first.
          // This is NOT a failure, so don't touch the backoff/retry budget.
          if (err instanceof DependencyNotReadyError) {
            const deferInfo = deferredTasksMap.get(taskQueueId) ?? {
              deferCount: 0,
              nextRetryTime: 0,
            }
            deferInfo.deferCount += 1
            deferInfo.nextRetryTime = now + DEFER_INTERVAL_MS
            deferredTasksMap.set(taskQueueId, deferInfo)
            log.info(
              `Deferring task ${taskQueueId} (${deferInfo.deferCount}/${MAX_DEFER_COUNT}) for ${DEFER_INTERVAL_MS / 1000}s: ${err.message}`,
            )
            // Re-poll sooner than the exclusion window expires (DEFER_REPOLL_MS <
            // DEFER_INTERVAL_MS) so the deferred task is still excluded at the
            // re-poll and the worker picks the older dependency instead of
            // re-selecting this (newer, higher-id) task.
            setTimeout(() => pollForNewTasks(), DEFER_REPOLL_MS)
            return
          }

          log.error(err, `Error processing task ${taskQueueId}`)

          // Non-retryable failures have already been deleted from the queue in
          // processTask(); don't record a backoff entry, just poll for more work.
          if (err instanceof NonRetryableTaskError) {
            clearFailedTaskId(taskQueueId)
            setTimeout(() => pollForNewTasks(), POLL_INTERVAL_MS)
            return
          }

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
      log.error(err, "Error fetching latest task queue ID")
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
  markTaskStarted(taskQueueId)

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
    if (error instanceof DependencyNotReadyError) {
      // Expected control-flow signal (waiting on a dependent build), not a failure.
      log.debug(`Task ${taskQueueId} deferred: ${error.message}`)
    } else {
      log.error(error, `Error processing task ${taskQueueId}`)
    }
    throw error
  } finally {
    markTaskFinished()
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
        const { projectId, uploadId, githubCheckData, gitlabCheckData } =
          data as Partial<IngestStorybookPayload>
        if (!projectId || !uploadId) {
          throw new Error(
            `Missing required ingest_storybook fields: projectId=${projectId}, uploadId=${uploadId}`,
          )
        }

        // If this render task depends on a baseline build that is still
        // pending/in-progress, defer it so the dependent is processed first and
        // this task gets a populated baseline (issue #125). Give up waiting after
        // MAX_DEFER_COUNT deferrals so a never-finishing dependency can't block
        // this task forever (livelock guard); in that case we process anyway.
        const deferCount =
          currentTaskId != undefined ? (deferredTasksMap.get(currentTaskId)?.deferCount ?? 0) : 0
        if (deferCount < MAX_DEFER_COUNT && (await isBaselineBuildPending(screenshotTestId))) {
          throw new DependencyNotReadyError(
            `Baseline build for screenshot test ${screenshotTestId} is still pending; deferring`,
          )
        }
        if (deferCount >= MAX_DEFER_COUNT) {
          log.warn(
            `Baseline for screenshot test ${screenshotTestId} did not finish after ${deferCount} deferrals; processing anyway`,
          )
        }

        await ingestStorybook(
          projectId,
          screenshotTestId,
          uploadId,
          githubCheckData,
          gitlabCheckData,
        )

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
    if (currentTaskId) {
      if (error instanceof NonRetryableTaskError) {
        // Permanent failure (e.g. the upload tarball is gone). Retrying cannot
        // succeed, so delete the task from the queue instead of releasing the
        // lock for backoff retries. The task handler has already marked the
        // ScreenshotTest as failed.
        log.warn(error, `Task ${currentTaskId} failed permanently, deleting from queue`)
        await deleteTask(currentTaskId)
      } else if (error instanceof BuildTimeoutError) {
        // A timed-out build is almost always stuck or pathologically large. Retrying would just
        // burn another full timeout window, so treat it as terminal: delete the task instead of
        // releasing the lock. The ScreenshotTest has already been marked "failed" by ingest.
        log.warn(`Task ${currentTaskId} exceeded the build timeout; deleting (non-retryable)`)
        await deleteTask(currentTaskId)
      } else {
        // On a transient error, release the lock so it can be retried with backoff
        await releaseLock(currentTaskId)
      }
    }
    throw error
  }
}

export function shutdown(): void {
  subscriber.close().catch((err: unknown) => {
    log.error(err, "Error during shutdown")
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
    log.error(error, "Error while sweeping for stuck builds")
    throw error
  }
}

// Entry point. Skipped under test so importing this module for unit tests does
// not start the background poll loop / database subscriber.
if (!IS_TEST) {
  main().catch((err: unknown) => {
    log.error(err, "Uncaught error in main()")
  })
}
