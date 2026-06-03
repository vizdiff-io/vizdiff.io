import jwt from "jsonwebtoken"
import { User } from "shared"

import { getAuthProvider } from "../auth"
import { Database } from "../database"
import { APP_URL, IS_PRODUCTION, JWT_SECRET } from "../environment"
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
  user = await userTable.save(user)

  // --- Begin retained JWT-cookie session logic (identity source changed; cookies unchanged) ---
  // Generate a JWT
  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "8h" })

  // Set a secure cookie for the JWT and a JS-accessible cookie to indicate that
  // the user is authenticated. The JWT lives for 8 hours and authenticated for
  // 30 days to allow for refreshing the JWT during that period.
  const domain = new URL(APP_URL).hostname
  res.cookie("token", token, {
    domain,
    httpOnly: true,
    secure: IS_PRODUCTION || req.secure ? true : undefined,
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000, // 8 hours in milliseconds
    path: "/",
  })
  res.cookie("authenticated", "true", {
    domain,
    httpOnly: false,
    secure: false,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
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
