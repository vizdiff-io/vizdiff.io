import { createAppAuth } from "@octokit/auth-app"
import { Octokit } from "@octokit/rest"
import type { Request, Response, NextFunction } from "express"
import type { JwtPayload, VerifyErrors } from "jsonwebtoken"
import jwt from "jsonwebtoken"
import { Project, User } from "shared"

import { Database } from "./database"
import { setUser } from "./datadog"
import {
  JWT_SECRET,
  GITHUB_APP_ID,
  GITHUB_PRIVATE_KEY,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  IS_PRODUCTION,
  S3_BUCKET_NAME,
} from "./environment"
import { getInstallationsForUserId } from "./github"
import { log } from "./log"
import type { RequestLocals } from "./types"

async function validateGitHubToken(user: User): Promise<boolean> {
  try {
    // First validate the OAuth token which all users have
    const octokit = new Octokit({ auth: user.githubAccessToken })
    await octokit.rest.users.getAuthenticated()

    // If they have any GitHub App installations, validate one of them too
    const installations = await getInstallationsForUserId(user.id)
    const firstInstallation = installations[0]
    if (firstInstallation) {
      const auth = createAppAuth({
        appId: GITHUB_APP_ID,
        privateKey: GITHUB_PRIVATE_KEY,
        clientId: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
      })
      const installationAuth = await auth({
        type: "installation",
        installationId: firstInstallation.installationId,
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

async function refreshJWT(userId: number, req: Request, res: Response): Promise<boolean> {
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
    log.error(err, "Failed to refresh JWT")
    return false
  }
}

export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  if (!IS_PRODUCTION) {
    const testUserId = req.headers["x-test-user-id"] as string | undefined
    if (testUserId) {
      const userId = parseInt(testUserId, 10)
      if (!isNaN(userId)) {
        ;(res.locals as RequestLocals).user = { id: userId } as User
        log.debug(`Using X-Test-User-Id: ${userId} for ${req.method} ${req.url}`)
        next()
        return
      }
    }
  }

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

  // Count the number of projects owned by this user
  const ownedProjectCount = await db.manager.count(Project, { where: { user: { id: user.id } } })

  // Associate this request with the user in Datadog
  // Get display name from GitHub or GitLab profile
  const githubName = (user.githubProfile as { name?: string } | null)?.name
  const gitlabName = (user.gitlabProfile as { name?: string } | null)?.name
  const displayName = githubName ?? gitlabName ?? user.githubUsername ?? user.gitlabUsername
  setUser({
    id: user.id.toString(),
    name: displayName ?? undefined,
    email: user.email ?? undefined,
    githubUsername: user.githubUsername ?? undefined,
    gitlabUsername: user.gitlabUsername ?? undefined,
    ownedProjectCount: ownedProjectCount.toString(),
    subscriptionPlan: user.subscriptionPlan ?? undefined,
    subscriptionInterval: user.subscriptionInterval ?? undefined,
  })

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
