// eslint-disable-next-line filenames/match-exported
import "reflect-metadata" // For TypeORM
import cookieParser from "cookie-parser"
import Express from "express"
import Router from "express-promise-router"
import { pino } from "pino"
import { pinoHttp } from "pino-http"

import { authenticateJWT } from "./authenticate"
import * as Auth from "./endpoints/auth"
import * as User from "./endpoints/user"
import { IS_PRODUCTION, IS_TEST } from "./environment"
import { log } from "./log"
import { DefaultRequest, DefaultResponse } from "./types"

const startTime = new Date().getTime()

const app = Express()
const port = process.env.PORT ?? 3001
const router = Router({ caseSensitive: true })

const httpLogger = IS_PRODUCTION
  ? pinoHttp({ level: "info" })
  : pinoHttp(
      { level: "debug" },
      pino.transport({
        target: "pino-http-print",
        options: { colorize: !IS_TEST, translateTime: "HH:MM:ss.l" },
      }) as pino.DestinationStream,
    )

// Register middleware
app.use(httpLogger)
app.use(cookieParser())

const indexHandler = (_req: DefaultRequest, res: DefaultResponse) => {
  res.json({ uptime: (new Date().getTime() - startTime) / 1000 })
}

// Register routes, middleware, and handlers
router.get("/", indexHandler)
router.get("/auth/github/callback", Auth.githubCallback)
router.get("/users/me", authenticateJWT, User.me)
app.use(router)
app.disable("x-powered-by")

// Error handling
app.use((err: Error, _req: DefaultRequest, res: DefaultResponse, _next: Express.NextFunction) => {
  res.err = err
  res.status(500).json({ error: err.message })
})

const server = app.listen(port, () => {
  const address = server.address()
  if (!address) {
    log.error(`Server failed to bind to port ${port}`)
    process.exit(1)
  }
  const portStr = typeof address === "string" ? address : address.port
  log.info(`Server is running at http://127.0.0.1:${portStr}`)
})

function handleUncaught(err: unknown, type: string) {
  log.fatal(err, `Uncaught ${type}`)
  server.close(() => process.exit(1)) // Attempt to shutdown gracefully
  setTimeout(() => process.abort(), 1000).unref() // Force terminate after 1s
}

process.on("uncaughtException", (err) => handleUncaught(err, "exception"))
process.on("unhandledRejection", (reason) => handleUncaught(reason, "rejection"))

export default server
