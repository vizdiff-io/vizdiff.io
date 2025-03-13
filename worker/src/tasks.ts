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
