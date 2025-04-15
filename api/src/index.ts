// eslint-disable-next-line filenames/match-exported
import "./datadog"

import "reflect-metadata" // For TypeORM
import bodyParser from "body-parser"
import cookieParser from "cookie-parser"
import cors from "cors"
import Express from "express"
import Router from "express-promise-router"
import { pinoHttp } from "pino-http"

import { authenticateJWT, requireUser } from "./authenticate"
import { InitializeDatabase } from "./database"
import * as Approval from "./endpoints/approval"
import * as Auth from "./endpoints/auth"
import * as Github from "./endpoints/github"
import * as Projects from "./endpoints/projects"
import * as ScreenshotTests from "./endpoints/screenshotTests"
import * as StripeEndpoints from "./endpoints/stripe"
import * as Upload from "./endpoints/upload"
import * as User from "./endpoints/user"
import * as Webhooks from "./endpoints/webhooks"
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
  ...(IS_PRODUCTION
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: !IS_TEST && !IS_PRODUCTION,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname,req,res,realIp,err,responseTime",
            messageFormat: "[{realIp}] {req.method} {req.url} {res.statusCode} {responseTime}ms",
          },
        },
      }),
}

const httpLogger = pinoHttp(httpLoggerConfig)

if (!IS_TEST) {
  // Initialize the database asynchronously, this will terminate the process if
  // the database connection fails
  void InitializeDatabase()
}

// Register middleware
app.use(httpLogger)

app.use(cookieParser())
app.disable("x-powered-by")
app.set("trust proxy", ["loopback", "linklocal", "uniquelocal"])

// Body parser that captures both raw and JSON parsed body
const rawBodyAndJsonParser = bodyParser.json({
  verify: (req: Express.Request & { rawBody?: Buffer }, _res, buf) => {
    req.rawBody = buf
  },
})

app.use(rawBodyAndJsonParser)
// Configure CORS
app.use(
  cors({
    origin: IS_PRODUCTION ? ["https://vizdiff.io", /\.vizdiff\.io$/] : undefined,
    credentials: true,
  }),
)

// Register routes
router.get("/", (_req: DefaultRequest, res: DefaultResponse) => {
  res.json({ uptime: (new Date().getTime() - startTime) / 1000 })
})

// Auth routes
router.get("/auth/github/callback", Auth.githubCallback)
router.get("/auth/github/installed", Auth.githubAppInstalled)
router.get("/auth/logout", Auth.logout) // Clears cookies only, no auth needed

router.get("/github/orgs", authenticateJWT, requireUser, Github.orgs)
router.get("/github/repos", authenticateJWT, requireUser, Github.repos)

router.get("/activity", authenticateJWT, requireUser, ScreenshotTests.listActivity)

router.get("/projects", authenticateJWT, requireUser, Projects.list)
router.get("/projects/:id", authenticateJWT, requireUser, Projects.get)
router.post("/projects", authenticateJWT, requireUser, Projects.create)
router.post("/projects/:id/reset-token", authenticateJWT, requireUser, Projects.resetToken)
router.delete("/projects/:id", authenticateJWT, requireUser, Projects.remove)

router.get("/projects/:projectId/builds", authenticateJWT, requireUser, ScreenshotTests.list)
router.get("/tests/:id", authenticateJWT, requireUser, ScreenshotTests.get)
router.post("/tests/:id/status/:status", authenticateJWT, requireUser, Approval.approveOrDeny)

router.get("/users/me", authenticateJWT, requireUser, User.me)
router.delete("/users/me", authenticateJWT, requireUser, User.deleteAccount)
router.post("/upload/storybook", Upload.uploadStorybook) // ?token=<project_token>

router.post("/stripe/checkout", authenticateJWT, requireUser, StripeEndpoints.createCheckoutSession)
router.post("/stripe/webhook", StripeEndpoints.stripeWebhook)

// GitHub webhook route
router.post("/webhooks/github", Webhooks.githubWebhook)

app.use("/api", router)

// Error handling
app.use((err: Error, _req: DefaultRequest, res: DefaultResponse, _next: Express.NextFunction) => {
  log.error(err, "Unhandled error")
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
