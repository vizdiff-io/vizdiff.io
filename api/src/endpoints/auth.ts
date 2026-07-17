import jwt from "jsonwebtoken"
import { User } from "shared"

import { getAuthProvider } from "../auth"
import { JWT_TTL, SESSION_MAX_AGE_MS } from "../authenticate"
import { Database } from "../database"
import { APP_URL, GITHUB_ENABLED, IS_PRODUCTION, JWT_SECRET } from "../environment"
import { syncUserInstallations } from "../github"
import { isValidRedirectUrl } from "../http"
import { log } from "../log"
import type { DefaultRequest, DefaultResponse } from "../types"

if (!APP_URL) {
  throw new Error("Missing APP_URL")
}

/**
 * GET /api/auth/login
 *
 * Begins an interactive login via the configured AuthProvider. Accepts an optional `?redirect=<URL>`
 * to return the user to after a successful sign-in.
 */
export async function login(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const provider = getAuthProvider()

  const redirectParam = typeof req.query.redirect === "string" ? req.query.redirect : undefined
  const redirectAfter =
    redirectParam && isValidRedirectUrl(redirectParam, APP_URL)
      ? redirectParam
      : `${APP_URL}/projects`

  const { redirectUrl } = await provider.beginLogin(req, res, redirectAfter)
  res.redirect(redirectUrl)
}

/**
 * GET /api/auth/callback
 *
 * Completes the login: the provider validates the IdP response and returns a verified identity. We
 * upsert the User by `authSubject` and issue the existing JWT session cookie.
 */
export async function callback(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const provider = getAuthProvider()

  const { identity, redirectAfter } = await provider.completeLogin(req, res)

  // Upsert the user by their stable provider subject.
  const db = await Database()
  const userTable = db.getRepository(User)
  let user = await userTable.findOneBy({ authSubject: identity.subject })
  if (!user) {
    log.info(
      { event: "user_created", subject: identity.subject, provider: identity.provider },
      `Creating new user for ${identity.provider} subject ${identity.subject}`,
    )
    user = new User()
    user.authSubject = identity.subject
  }
  user.authProvider = identity.provider
  user.displayName = identity.displayName
  if (identity.email) {
    user.email = identity.email
  }
  // Link the user's GitHub account when authenticating via GitHub, so the GitHub App integration
  // (installations, repo listing, checks) and the account UI work.
  if (identity.vcs?.provider === "github") {
    user.githubId = identity.vcs.id
    user.githubUsername = identity.vcs.username
    user.githubProfile = identity.vcs.profile
    user.githubAccessToken = identity.vcs.accessToken
  }
  user = await userTable.save(user)

  // Best-effort: record the user's GitHub App installations (and any just-installed one). Never
  // blocks login.
  if (identity.vcs?.provider === "github" && GITHUB_ENABLED) {
    const linkedUser = user
    const installationId = identity.vcs.installationId
    void syncUserInstallations(linkedUser, installationId).catch((err: unknown) => {
      log.warn(`Failed to sync GitHub installations for user ${linkedUser.id}: ${String(err)}`)
    })
  }

  // --- Begin retained JWT-cookie session logic (identity source changed; cookies unchanged) ---
  // Generate a JWT
  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: JWT_TTL })

  // Set a secure cookie for the JWT and a JS-accessible cookie to indicate that
  // the user is authenticated. The JWT lives for 8 hours, while both cookies persist for the full
  // 30-day session so the expired JWT can be transparently refreshed during that period.
  const domain = new URL(APP_URL).hostname
  res.cookie("token", token, {
    domain,
    httpOnly: true,
    secure: IS_PRODUCTION || req.secure ? true : undefined,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  })
  res.cookie("authenticated", "true", {
    domain,
    httpOnly: false,
    secure: false,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  })
  // --- End retained JWT-cookie session logic ---

  // Append a `signed_in` query param to the redirect URL so we can track the user's sign-in
  let finalRedirect = redirectAfter
  const url = new URL(finalRedirect)
  url.searchParams.set("signed_in", "true")
  finalRedirect = url.toString()

  res.redirect(finalRedirect)
}

/**
 * GET /api/auth/logout — clears the session cookies and (optionally) redirects to IdP sign-out.
 */
export function logout(req: DefaultRequest, res: DefaultResponse): void {
  const domain = new URL(APP_URL).hostname
  res.clearCookie("token", {
    domain,
    httpOnly: true,
    secure: IS_PRODUCTION || req.secure ? true : undefined,
    sameSite: "lax",
    path: "/",
  })
  res.clearCookie("authenticated", {
    domain,
    httpOnly: false,
    secure: false,
    sameSite: "lax",
    path: "/",
  })

  const provider = getAuthProvider()
  const idpLogoutUrl = provider.logoutUrl?.(req)
  res.redirect(idpLogoutUrl ?? APP_URL)
}
