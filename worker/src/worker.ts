import pg from "pg"
import createPgSubscriber from "pg-listen"

import {
  POSTGRES_USER,
  POSTGRES_HOST,
  POSTGRES_DATABASE,
  POSTGRES_PASS,
  POSTGRES_PORT,
} from "./environment"
import { log } from "./log"

type IngestStorybookPayload = {
  projectId: string
  uploadId: string
}

const TASKS_CHANNEL = "task_queue"
const CONN_STRING = `postgres://${POSTGRES_USER}:${POSTGRES_PASS}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}`
const POLL_INTERVAL_MS = 1000 * 10

// Postgres connection pool
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

// TASK: Periodic sweep to check for new tasks
// TASK: Locking mechanism to prevent multiple workers from processing the same task
// TASK: Implement ingestStorybook()

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

    startTask(taskQueueId).catch((err) => log.error("Error processing task:", err))
  })

  subscriber.events.on("error", (error) => {
    log.error("Fatal database connection error:", error)
    process.exit(1)
  })

  process.on("exit", shutdown)

  await subscriber.connect()
  await subscriber.listenTo(TASKS_CHANNEL)

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
        .catch((err) => {
          log.error(`Error processing task ${taskQueueId}: ${err}`)
        })
        .finally(() => {
          setTimeout(pollForNewTasks, 0)
        })
    })
    .catch((err) => {
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
  await processTask(task.task_type, task.data).finally(async () => {
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

export async function fetchTask(
  taskQueueId: number,
): Promise<{ task_type: string; data: Record<string, unknown> } | undefined> {
  const client = await pool.connect()
  try {
    // First try to acquire the lock atomically
    const lockRes = await client.query(
      `UPDATE task_queue 
       SET locked_at = NOW(), locked_by = $1
       WHERE id = $2 AND locked_at IS NULL
       RETURNING task_type, data`,
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

    return lockRes.rows[0] as { task_type: string; data: Record<string, unknown> }
  } finally {
    client.release()
  }
}

export async function processTask(taskType: string, data: Record<string, unknown>): Promise<void> {
  log.info(`Processing task: [${taskType}] ${data}`)
  try {
    switch (taskType) {
      case "ingest_storybook": {
        const { projectId, uploadId } = data as IngestStorybookPayload
        await ingestStorybook(projectId, uploadId)
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
  subscriber.close().catch((err) => {
    log.error("Error during shutdown:", err)
    process.exit(1)
  })
}

async function ingestStorybook(projectId: string, uploadId: string): Promise<void> {
  log.info(`Ingesting storybook for project ${projectId}, upload ${uploadId}`)
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

main().catch((err) => {
  log.error(`Fatal error: ${err}`)
})
