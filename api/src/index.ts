import "reflect-metadata" // For TypeORM
import express, { Router } from "express"
import { auth } from "./endpoints/auth"
import { user } from "./endpoints/user"
import { DefaultRequest, DefaultResponse } from "./types"
import { authenticateJWT } from "./authenticate"
import { pinoHttp } from "pino-http"
import { log } from "./log"

const IS_PRODUCTION = process.env.NODE_ENV === "production"

const startTime = new Date().getTime()

const app = express()
const port = process.env.PORT || 3001
const router = Router({ caseSensitive: true })

// Register logging middleware
app.use(pinoHttp({ level: IS_PRODUCTION ? "info" : "debug" }))

const indexHandler = (_req: DefaultRequest, res: DefaultResponse) => {
  res.json({ uptime: (new Date().getTime() - startTime) / 1000 })
}

// Register routes, middleware, and handlers
router.get("/", indexHandler)
router.get("/users/me", authenticateJWT, user)
router.get("/auth/github/callback", auth)

const server = app.listen(port, () => {
  const address = server.address()
  if (!address) {
    log.error(`Server failed to bind to port ${port}`)
    process.exit(1)
  }
  const portStr = typeof address === "string" ? address : address.port
  log.info(`Server is running at http://127.0.0.1:${portStr}`)
})

export default server
