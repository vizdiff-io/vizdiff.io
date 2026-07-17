import type { Request, Response, NextFunction } from "express"
import type { JwtPayload, VerifyErrors } from "jsonwebtoken"
import jwt from "jsonwebtoken"
import { Project, User } from "shared"

import { Database } from "./database"
import { JWT_SECRET, IS_PRODUCTION } from "./environment"
import { log } from "./log"
import type { RequestLocals } from "./types"

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
    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "8h" })

    // Set the new token in a cookie with 8 hour expiration
    res.cookie("token", token, {
      httpOnly: true,
      secure: IS_PRODUCTION || req.secure ? true : undefined,
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000, // 8 hours in milliseconds
      path: "/",
    })

    return true
  } catch (err) {
    log.error(err, "Failed to refresh JWT")
    return false
  }
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
        // If the token is expired, try to refresh it
        if (err.name === "TokenExpiredError" && typeof decoded === "object" && decoded.sub) {
          const userId = parseInt(decoded.sub, 10)
          const refreshed = await refreshJWT(userId, req, res)
          if (refreshed) {
            // Set user in res.locals from the verified JWT payload and continue
            ;(res.locals as RequestLocals).user = { id: userId } as User
            log.debug(`Request authenticated as user ${userId} via refreshed JWT`)
            next()
            return
          }
        }

        log.warn(`JWT verification failed for [${token}]: ${err.message}`)
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

  locals.user = user
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
