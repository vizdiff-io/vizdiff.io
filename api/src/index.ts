import "reflect-metadata" // For TypeORM
import Express from "express"
import Router from "express-promise-router"
import { auth } from "./endpoints/auth"
import { user } from "./endpoints/user"
import { DefaultRequest, DefaultResponse } from "./types"
import { authenticateJWT } from "./authenticate"
import { pinoHttp } from "pino-http"
import { log } from "./log"
import cookieParser from "cookie-parser"

const IS_PRODUCTION = process.env.NODE_ENV === "production"

const startTime = new Date().getTime()

const app = Express()
const port = process.env.PORT || 3001
const router = Router({ caseSensitive: true })

// Register middleware
app.use(pinoHttp({ level: IS_PRODUCTION ? "info" : "debug" }))
app.use(cookieParser())

const indexHandler = (_req: DefaultRequest, res: DefaultResponse) => {
  res.json({ uptime: (new Date().getTime() - startTime) / 1000 })
}

// Register routes, middleware, and handlers
router.get("/", indexHandler)
router.get("/users/me", authenticateJWT, user)
router.get("/auth/github/callback", auth)
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
