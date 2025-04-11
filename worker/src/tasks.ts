import { DatabasePool } from "./database"
import { log } from "./log"

type Task = {
  task_type: string
  screenshot_test_id: number
  data: Record<string, unknown>
}

const LOCK_TIMEOUT_MINUTES = 60

export async function latestTaskQueueId(): Promise<number | undefined> {
  const client = await DatabasePool()
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
  const client = await DatabasePool()
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

    // Validate the task entry has the expected fields and types
    const row = lockRes.rows[0] as unknown
    if (
      !row ||
      typeof row !== "object" ||
      !("task_type" in row) ||
      !("screenshot_test_id" in row) ||
      !("data" in row) ||
      typeof row.task_type !== "string" ||
      typeof row.screenshot_test_id !== "number" ||
      typeof row.data !== "object"
    ) {
      throw new Error(`Task ${taskQueueId} has invalid row: ${JSON.stringify(row)}`)
    }

    return row as Task
  } finally {
    client.release()
  }
}
