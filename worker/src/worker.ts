import createPgSubscriber from "pg-listen"

import {
  POSTGRES_USER,
  POSTGRES_HOST,
  POSTGRES_DATABASE,
  POSTGRES_PASS,
  POSTGRES_PORT,
} from "./environment"

const TASKS_CHANNEL = "task_queue"
const CONN_STRING = `postgres://${POSTGRES_USER}:${POSTGRES_PASS}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}`

const subscriber = createPgSubscriber({ connectionString: CONN_STRING })

async function main() {
  subscriber.notifications.on(TASKS_CHANNEL, (payload) => {
    console.log(`Received notification in '${TASKS_CHANNEL}':`, payload)
  })

  subscriber.events.on("error", (error) => {
    console.error("Fatal database connection error:", error)
    process.exit(1)
  })

  process.on("exit", shutdown)

  await subscriber.connect()
  await subscriber.listenTo(TASKS_CHANNEL)
}

export function processTask(taskType: string, _data: Record<string, unknown>): void {
  switch (taskType) {
    default:
      throw new Error(`Unknown task type: ${taskType}`)
  }
}

export function shutdown(): void {
  subscriber.close().catch((err) => {
    console.error("Error during shutdown:", err)
    process.exit(1)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
