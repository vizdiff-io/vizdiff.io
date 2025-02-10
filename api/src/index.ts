// eslint-disable-next-line filenames/match-exported
import "reflect-metadata" // For TypeORM
import bodyParser from "body-parser"
import cookieParser from "cookie-parser"
import cors from "cors"
import Express from "express"
import Router from "express-promise-router"
import { pinoHttp } from "pino-http"

import { authenticateJWT } from "./authenticate"
import { InitializeDatabase } from "./database"
import * as Approval from "./endpoints/approval"
import * as Auth from "./endpoints/auth"
import * as Github from "./endpoints/github"
import * as Projects from "./endpoints/projects"
import * as ScreenshotTests from "./endpoints/screenshot-tests"
import * as Upload from "./endpoints/upload"
import * as User from "./endpoints/user"
import { IS_PRODUCTION, IS_TEST, PORT } from "./environment"
import { log } from "./log"
import type { DefaultRequest, DefaultResponse } from "./types"

const startTime = new Date().getTime()

const app = Express()
const router = Router({ caseSensitive: true })

const httpLoggerConfig = {
  level: IS_PRODUCTION ? "info" : "debug",
  customProps: (req: DefaultRequest) => ({
    realIp: (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0] ?? req.ip,
  }),
  transport: {
    target: "pino-pretty",
    options: {
      colorize: !IS_TEST && !IS_PRODUCTION,
      translateTime: "HH:MM:ss.l",
      ignore: "pid,hostname,req,res,realIp,err,responseTime",
      messageFormat: "[{realIp}] {req.method} {req.url} {res.statusCode} {responseTime}ms",
    },
  },
}

const httpLogger = pinoHttp(httpLoggerConfig)

if (!IS_TEST) {
  // Initialize the database asynchronously, this will terminate the process if
  // the database connection fails
  void InitializeDatabase()
}

// Register middleware
app.use(httpLogger)
app.use(cors())
app.use(cookieParser())
app.use(bodyParser.json())
app.disable("x-powered-by")
app.set("trust proxy", ["loopback", "linklocal", "uniquelocal"])

// Register routes
router.get("/", (_req: DefaultRequest, res: DefaultResponse) => {
  res.json({ uptime: (new Date().getTime() - startTime) / 1000 })
})

router.get("/auth/github/callback", Auth.githubCallback)
router.get("/auth/logout", Auth.logout) // Clears cookies only, no auth needed

router.get("/github/orgs", authenticateJWT, Github.orgs)
router.get("/github/repos", authenticateJWT, Github.repos)

router.get("/projects", authenticateJWT, Projects.list)
router.get("/projects/:id", authenticateJWT, Projects.get)
router.delete("/projects/:id", authenticateJWT, Projects.remove)
router.post("/projects", authenticateJWT, Projects.create)

router.get("/tests/:id", authenticateJWT, ScreenshotTests.get)
router.post("/tests/:id/status/:status", authenticateJWT, Approval.approveOrDeny)

router.post("/upload/storybook", Upload.uploadStorybook) // ?token=<project_token>

router.get("/users/me", authenticateJWT, User.me)

app.use(router)

// Error handling
app.use((err: Error, _req: DefaultRequest, res: DefaultResponse, _next: Express.NextFunction) => {
  log.error(err.message)
  res.err = err
  res.status(500).json({ error: err.message })
})

// Start the server
const server = app.listen(PORT, () => {
  const address = server.address()
  if (!address) {
    log.error(`Server failed to bind to port ${PORT}`)
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
