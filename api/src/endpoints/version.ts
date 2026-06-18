import { Database } from "../database"
import { VIZDIFF_VERSION } from "../environment"
import { log } from "../log"
import type { DefaultRequest, DefaultResponse } from "../types"

// A worker is considered online if it has heartbeated within this window (heartbeat is every 10s).
const WORKER_ONLINE_WINDOW_MS = 60_000

/**
 * Public endpoint reporting the running product version of the api and worker, for display in the
 * UI footer. The api reports its own baked-in VIZDIFF_VERSION; the worker version is read from the
 * `worker_status` table the worker upserts on each heartbeat (its health port is not reachable from
 * the frontend). Always returns 200 — `worker` is null and `workerOnline` false when unknown.
 */
export async function version(_req: DefaultRequest, res: DefaultResponse): Promise<void> {
  let worker: string | null = null
  let workerOnline = false
  try {
    const db = await Database()
    const rows: Array<{ version: string; last_heartbeat_at: Date }> = await db.query(
      `SELECT version, last_heartbeat_at FROM worker_status ORDER BY last_heartbeat_at DESC LIMIT 1`,
    )
    if (rows[0]) {
      worker = rows[0].version
      const lastHeartbeat = new Date(rows[0].last_heartbeat_at).getTime()
      workerOnline = Date.now() - lastHeartbeat < WORKER_ONLINE_WINDOW_MS
    }
  } catch (error) {
    log.warn(`Failed to read worker_status for /version: ${String(error)}`)
  }
  res.json({ api: VIZDIFF_VERSION, worker, workerOnline })
}
