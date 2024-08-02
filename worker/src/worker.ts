import { Pool } from "pg"
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

const pool = new Pool({
  host: POSTGRES_HOST,
  user: POSTGRES_USER,
  password: POSTGRES_PASS,
  database: POSTGRES_DATABASE,
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

const subscriber = createPgSubscriber({ connectionString: CONN_STRING })

// FIXME: Periodic sweep to check for new tasks
// FIXME: Locking mechanism to prevent multiple workers from processing the same task
// FIXME: Implement ingestStorybook()

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

    fetchTask(taskQueueId)
      .then(({ task_type, data }) => processTask(task_type, data))
      .catch((err) => log.error("Error processing task:", err))
  })

  subscriber.events.on("error", (error) => {
    log.error("Fatal database connection error:", error)
    process.exit(1)
  })

  process.on("exit", shutdown)

  await subscriber.connect()
  await subscriber.listenTo(TASKS_CHANNEL)
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
): Promise<{ task_type: string; data: Record<string, unknown> }> {
  // Fetch the task from the database
  const client = await pool.connect()
  try {
    const res = await client.query("select task_type, data from task_queue where id = $1", [
      taskQueueId,
    ])
    if (res.rowCount === 0) {
      throw new Error(`Task not found: ${taskQueueId}`)
    }
    return res.rows[0] as { task_type: string; data: Record<string, unknown> }
  } finally {
    client.release()
  }
}

export function processTask(taskType: string, data: Record<string, unknown>): void {
  switch (taskType) {
    case "ingest_storybook": {
      const { projectId, uploadId } = data as IngestStorybookPayload
      ingestStorybook(projectId, uploadId).catch((err) => {
        log.error("Error processing task:", err)
      })
      break
    }
    default:
      throw new Error(`Unknown task type: ${taskType}`)
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

main().catch((err) => {
  log.error(err)
  process.exit(1)
})
