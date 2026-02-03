import http from "node:http"

import { WORKER_HEALTH_PORT } from "./environment"
import { log } from "./log"

let lastHeartbeatAt = Date.now()
let lastTaskStartedAt: number | null = null
let lastTaskFinishedAt: number | null = null
let activeTaskId: number | null = null

export function markTaskStarted(taskId: number): void {
  activeTaskId = taskId
  lastTaskStartedAt = Date.now()
}

export function markTaskFinished(): void {
  activeTaskId = null
  lastTaskFinishedAt = Date.now()
}

export function startHealthServer(): void {
  const server = http.createServer((req, res) => {
    if (req.url !== "/health") {
      res.statusCode = 404
      res.end()
      return
    }

    const payload = {
      status: "ok",
      lastHeartbeatAt,
      lastTaskStartedAt,
      lastTaskFinishedAt,
      activeTaskId,
    }

    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify(payload))
  })

  server.listen(WORKER_HEALTH_PORT, () => {
    log.info(`Worker health endpoint listening on http://127.0.0.1:${WORKER_HEALTH_PORT}/health`)
  })

  setInterval(() => {
    lastHeartbeatAt = Date.now()
  }, 10_000).unref()
}
