import type { Request, Response, NextFunction } from "express"
import type { JwtPayload, VerifyErrors } from "jsonwebtoken"
import jwt from "jsonwebtoken"
import { Project, User } from "shared"

import { Database } from "./database"
import { JWT_SECRET, IS_PRODUCTION, S3_BUCKET_NAME } from "./environment"
import { log } from "./log"
import type { RequestLocals } from "./types"

/** Lifetime of an issued session JWT (the short-lived credential). */
export const JWT_TTL = "8h"
/**
 * Lifetime of the session: how long the `token` cookie persists and how far back an expired JWT's
 * issue time (`iat`) may be while still qualifying for a transparent refresh.
 */
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds

/**
 * Re-issue a JWT cookie for a still-valid user whose token has expired. Identity is now owned by
 * the configured AuthProvider, so there are no VCS tokens to validate here — we simply reload the
 * user by `sub` and re-issue if they still exist.
 */
async function refreshJWT(userId: number, req: Request, res: Response): Promise<boolean> {
  try {
    const db = await Database()
    const user = await db.manager.findOneBy(User, { id: userId })
    if (!user) {
      return false
    }

    // Generate a new JWT token with 8 hour expiration
    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: JWT_TTL })

    // Set the new token in a cookie that outlives the JWT so it can be refreshed again
    res.cookie("token", token, {
      httpOnly: true,
      secure: IS_PRODUCTION || req.secure ? true : undefined,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_MS,
      path: "/",
    })

    return true
  } catch (err) {
    log.error(err, "Failed to refresh JWT")
    return false
  }
}

/**
 * Attempt a transparent refresh for an expired JWT. jsonwebtoken does not pass the payload to the
 * `verify` callback on error, so we re-verify the signature ourselves (skipping only the
 * expiration check — NOT a bare decode) to recover the claims, then refresh if the token was
 * issued within the session window. Returns the user id on success, undefined otherwise.
 */
async function tryRefreshExpiredJWT(
  token: string,
  req: Request,
  res: Response,
): Promise<number | undefined> {
  let payload: JwtPayload | string
  try {
    payload = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true })
  } catch {
    return undefined
  }

  if (typeof payload !== "object" || !payload.sub || typeof payload.iat !== "number") {
    return undefined
  }

  // Only refresh tokens issued within the session window; older sessions must sign in again
  if (payload.iat * 1000 + SESSION_MAX_AGE_MS <= Date.now()) {
    return undefined
  }

  const userId = parseInt(payload.sub, 10)
  if (isNaN(userId)) {
    return undefined
  }

  const refreshed = await refreshJWT(userId, req, res)
  return refreshed ? userId : undefined
}

export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const jwtHeader = Array.isArray(req.headers.jwt) ? req.headers.jwt[0] : req.headers.jwt
  const jwtCookie = req.cookies.token as string | undefined
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
    async (err: VerifyErrors | null, decoded: JwtPayload | string | undefined) => {
      if (err) {
        // If the token is expired (but otherwise valid), try to refresh it
        if (err.name === "TokenExpiredError") {
          const userId = await tryRefreshExpiredJWT(token, req, res)
          if (userId != undefined) {
            // Set user in res.locals from the verified JWT payload and continue
            ;(res.locals as RequestLocals).user = { id: userId } as User
            log.debug(`Request authenticated as user ${userId} via refreshed JWT`)
            next()
            return
          }
        }

        log.warn(`JWT verification failed: ${err.message}`)
        res.status(401).json({ error: "Unauthorized" })
        return
      }

      if (typeof decoded !== "object" || !decoded.sub) {
        log.warn(
          `JWT verification failed: decoded payload is not an object or does not contain a "sub" field`,
        )
        res.status(401).json({ error: "Unauthorized" })
        return
      }

      // Set user in res.locals from the verified JWT payload
      ;(res.locals as RequestLocals).user = { id: parseInt(decoded.sub, 10) } as User
      log.trace(`Request authenticated as user ${decoded.sub} via JWT`)
      next()
    },
  )
}

export async function requireUser(_req: Request, res: Response, next: NextFunction): Promise<void> {
  const locals = res.locals as RequestLocals
  if (!locals.user.id) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const db = await Database()
  const user = await db.manager.findOneBy(User, { id: locals.user.id })
  if (!user) {
    res.status(401).json({ error: "User not found" })
    return
  }

  // Count the number of projects owned by this user
  const ownedProjectCount = await db.manager.count(Project, { where: { user: { id: user.id } } })

  locals.user = user
  locals.ownedProjectCount = ownedProjectCount
  next()
}

export async function getProjectByToken(token: string): Promise<Project | undefined> {
  if (token.length < 12 || token.length > 128) {
    log.error(`Invalid token length: ${token.length}`)
    return undefined
  }

  // Look up the project by token
  const db = await Database()
  const projectTable = db.getRepository(Project)
  const project = await projectTable.findOneBy({ token })
  if (!project) {
    log.error(`Invalid or expired token: ${token}`)
    return undefined
  }

  return project
}

export async function getS3BucketForProject(_project: Project): Promise<string> {
  return S3_BUCKET_NAME
}
