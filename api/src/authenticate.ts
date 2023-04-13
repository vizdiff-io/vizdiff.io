import { Request, Response, NextFunction } from "express"
import jwt, { JwtPayload, VerifyErrors } from "jsonwebtoken"

import { Database } from "./database"
import { User } from "./entity/User"
import { JWT_SECRET } from "./environment"
import { getCookieString } from "./http"
import { log } from "./log"
import { AuthenticatedRequest, DefaultRequest, MaybeAuthenticatedRequest } from "./types"

export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const token = getCookieString("token", req) ?? req.headers.authorization?.split(" ")[1]

  if (!token) {
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
