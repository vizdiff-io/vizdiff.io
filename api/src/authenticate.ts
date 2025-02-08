import type { Response, NextFunction } from "express"
import type { JwtPayload, VerifyErrors } from "jsonwebtoken"
import jwt from "jsonwebtoken"
import { Project, User } from "shared"

import { Database } from "./database"
import { JWT_SECRET } from "./environment"
import { log } from "./log"
import type { AuthenticatedRequest, DefaultRequest, MaybeAuthenticatedRequest } from "./types"

export function authenticateJWT(req: DefaultRequest, res: Response, next: NextFunction): void {
  const jwtHeader = Array.isArray(req.headers.jwt) ? req.headers.jwt[0] : req.headers.jwt
  const jwtCookie = String(req.cookies.token)
  const token = (jwtHeader?.length ?? 0) > 0 ? jwtHeader : jwtCookie

  if (!token) {
    const src = req.ip ?? "unknown"
    const cookies = Object.keys(req.cookies).join(", ")
    log.warn(`No JWT token found in ${req.method} ${req.url} from ${src}, cookies=${cookies}`)
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  jwt.verify(
    token,
    JWT_SECRET,
    { complete: false },
    (err: VerifyErrors | null, decoded: JwtPayload | string | undefined) => {
      if (err) {
        log.warn(`JWT verification failed: ${err.message}`)
        res.status(403).json({ error: "Forbidden" })
        return
      }

      if (typeof decoded !== "object" || !decoded.sub) {
        log.warn(
          `JWT verification failed: decoded payload is not an object or does not contain a "sub" field`,
        )
        res.status(403).json({ error: "Forbidden" })
        return
      }

      // Set req.userId from the verified JWT payload
      const reqWithUserId = req as AuthenticatedRequest
      reqWithUserId.userId = parseInt(decoded.sub, 10)
      log.debug(`Request authenticated as user ${reqWithUserId.userId} via JWT`)
      next()
    },
  )
}

export async function getUser(req: DefaultRequest): Promise<User> {
  const maybeAuthedReq = req as MaybeAuthenticatedRequest
  if (maybeAuthedReq.userId == undefined) {
    throw new Error(`Request is not authenticated`)
  }

  const userId = maybeAuthedReq.userId
  const db = await Database()
  const user = await db.manager.findOneBy(User, { id: userId })
  if (!user) {
    throw new Error(`User id "${userId}" not found`)
  }

  log.debug(`User ${user.id} (${user.githubUsername}) retrieved from the database`)
  return user
}

export async function getProjectByToken(token: string): Promise<Project> {
  if (token.length !== 12) {
    throw new Error("Invalid token")
  }

  // Look up the project by token
  const db = await Database()
  const projectTable = db.getRepository(Project)
  const project = await projectTable.findOneBy({ token })
  if (!project) {
    throw new Error(`Invalid or expired token`)
  }

  return project
}

export async function getS3BucketForProject(_project: Project): Promise<string> {
  return "vizdiff-testing"
}
