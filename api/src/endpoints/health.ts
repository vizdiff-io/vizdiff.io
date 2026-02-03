import { Database } from "../database"
import { log } from "../log"
import type { DefaultRequest, DefaultResponse } from "../types"

export async function health(_req: DefaultRequest, res: DefaultResponse): Promise<void> {
  try {
    const db = await Database()
    await db.query("SELECT 1")
    res.json({ status: "ok" })
  } catch (error) {
    log.error(error, "Health check failed")
    res.status(503).json({ status: "error", error: "database_unavailable" })
  }
}
