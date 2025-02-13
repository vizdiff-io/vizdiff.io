import { createAppAuth } from "@octokit/auth-app"
import { Octokit } from "@octokit/rest"
import type { Response, NextFunction } from "express"
import type { JwtPayload, VerifyErrors } from "jsonwebtoken"
import jwt from "jsonwebtoken"
import { Project, User } from "shared"

import { Database } from "./database"
import {
  JWT_SECRET,
  GITHUB_APP_ID,
  GITHUB_PRIVATE_KEY,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  IS_PRODUCTION,
} from "./environment"
import { log } from "./log"
import type { AuthenticatedRequest, DefaultRequest, MaybeAuthenticatedRequest } from "./types"

async function validateGitHubToken(user: User): Promise<boolean> {
  try {
    // First validate the OAuth token which all users have
    const octokit = new Octokit({ auth: user.githubAccessToken })
    await octokit.rest.users.getAuthenticated()

    // If they have a GitHub App installation, validate that too
    if (typeof user.githubInstallationId === "number") {
      const auth = createAppAuth({
        appId: GITHUB_APP_ID,
        privateKey: GITHUB_PRIVATE_KEY,
        clientId: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
      })
      const installationAuth = await auth({
        type: "installation",
        installationId: user.githubInstallationId,
      })
      const appOctokit = new Octokit({ auth: installationAuth.token })
      await appOctokit.rest.apps.getAuthenticated()
    }

    return true
  } catch (error) {
    if (error instanceof Error) {
      log.warn(`GitHub token validation failed: ${error.message}`)
    } else {
      log.warn("GitHub token validation failed with unknown error")
    }
    return false
  }
}

async function refreshJWT(userId: number, req: DefaultRequest, res: Response): Promise<boolean> {
  try {
    // Get the user from the database
    const db = await Database()
    const user = await db.manager.findOneBy(User, { id: userId })
    if (!user) {
      return false
    }

    // Validate both OAuth and GitHub App tokens as needed
    const isValid = await validateGitHubToken(user)
    if (!isValid) {
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
    log.error(`Failed to refresh JWT: ${err}`)
    return false
  }
}

export function authenticateJWT(req: DefaultRequest, res: Response, next: NextFunction): void {
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
            // Set req.userId from the verified JWT payload and continue
            const reqWithUserId = req as AuthenticatedRequest
            reqWithUserId.userId = userId
            log.debug(`Request authenticated as user ${reqWithUserId.userId} via refreshed JWT`)
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

      // Set req.userId from the verified JWT payload
      const reqWithUserId = req as AuthenticatedRequest
      reqWithUserId.userId = parseInt(decoded.sub, 10)
      log.debug(`Request authenticated as user ${reqWithUserId.userId} via JWT`)
      next()
    },
  )
}

export function getUserId(req: DefaultRequest): number {
  const maybeAuthedReq = req as MaybeAuthenticatedRequest
  if (maybeAuthedReq.userId == undefined) {
    throw new Error(`Request is not authenticated`)
  }
  return maybeAuthedReq.userId
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
