import { Octokit } from "@octokit/rest"
import jwt from "jsonwebtoken"
import crypto from "node:crypto"
import { fetch } from "undici"

import {
  APP_URL,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  IS_PRODUCTION,
  JWT_SECRET,
} from "../environment"
import { isValidRedirectUrl } from "../http"
import { log } from "../log"
import type { DefaultRequest, DefaultResponse } from "../types"
import type { AuthProvider, AuthenticatedIdentity } from "./AuthProvider"

const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize"
const GITHUB_TOKEN_EXCHANGE = "https://github.com/login/oauth/access_token"

// Transient cookie carrying the signed OAuth state across the GitHub redirect. Signed with
// JWT_SECRET so the deployment stays stateless (no server-side session store).
const STATE_COOKIE = "github_oauth_state"
const STATE_TTL_SECONDS = 600 // 10 minutes

interface GitHubStatePayload {
  state: string
  redirectAfter: string
  installationId?: number
}

interface GitHubUser {
  id: number
  login: string
  name: string | null
  email: string | null
  [key: string]: unknown
}

/**
 * Authenticates users via GitHub OAuth. Selected with `AUTH_PROVIDER=github` for GitHub-mode
 * deployments. In addition to identity, it links the user's GitHub account (id/username/profile and
 * OAuth token) so the GitHub App integration (installations, repo listing, checks) works.
 */
export class GitHubAuthProvider implements AuthProvider {
  readonly name = "github"
  readonly interactive = true

  constructor() {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      throw new Error(
        "GitHub auth provider requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to be configured.",
      )
    }
  }

  get #redirectUri(): string {
    return `${APP_URL}/api/auth/callback`
  }

  beginLogin(
    req: DefaultRequest,
    res: DefaultResponse,
    redirectAfter: string,
  ): Promise<{ redirectUrl: string }> {
    const state = crypto.randomBytes(16).toString("hex")

    // The GitHub App "Setup URL" redirects here with an installation_id after an app install; carry
    // it through so the callback can record the new installation for this user.
    const installationIdRaw = req.query.installation_id
    const installationId =
      typeof installationIdRaw === "string" ? parseInt(installationIdRaw, 10) : NaN

    const payload: GitHubStatePayload = {
      state,
      redirectAfter,
      installationId: Number.isFinite(installationId) ? installationId : undefined,
    }
    const stateToken = jwt.sign(payload, JWT_SECRET, { expiresIn: STATE_TTL_SECONDS })
    res.cookie(STATE_COOKIE, stateToken, {
      httpOnly: true,
      secure: IS_PRODUCTION ? true : undefined,
      sameSite: "lax",
      maxAge: STATE_TTL_SECONDS * 1000,
      path: "/",
    })

    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: this.#redirectUri,
      scope: "read:user user:email",
      state,
    })
    return Promise.resolve({ redirectUrl: `${GITHUB_AUTHORIZE}?${params.toString()}` })
  }

  async completeLogin(
    req: DefaultRequest,
    res: DefaultResponse,
  ): Promise<{ identity: AuthenticatedIdentity; redirectAfter: string }> {
    const code = typeof req.query.code === "string" ? req.query.code : undefined
    if (!code) {
      throw new Error("Missing GitHub OAuth code")
    }
    const returnedState = typeof req.query.state === "string" ? req.query.state : undefined

    const stateToken = req.cookies[STATE_COOKIE] as string | undefined
    if (!stateToken) {
      throw new Error(
        "Missing GitHub OAuth state cookie; login flow expired or cookies are blocked",
      )
    }
    let statePayload: GitHubStatePayload
    try {
      statePayload = jwt.verify(stateToken, JWT_SECRET) as GitHubStatePayload
    } catch (err) {
      log.warn(`GitHub OAuth state verification failed: ${String(err)}`)
      throw new Error("Invalid or expired GitHub OAuth state")
    }
    res.clearCookie(STATE_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" })

    if (!returnedState || returnedState !== statePayload.state) {
      throw new Error("GitHub OAuth state mismatch")
    }

    // Exchange the authorization code for an access token.
    const tokenRes = await fetch(GITHUB_TOKEN_EXCHANGE, {
      method: "POST",
      body: new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: this.#redirectUri,
      }),
      headers: { Accept: "application/json" },
    })
    if (!tokenRes.ok) {
      throw new Error(`GitHub token exchange failed: ${tokenRes.status}`)
    }
    const tokenData = (await tokenRes.json()) as { access_token?: string }
    if (!tokenData.access_token) {
      throw new Error("Missing access_token in GitHub token response")
    }

    // Fetch the authenticated user's profile.
    const octokit = new Octokit({ auth: tokenData.access_token })
    const ghUser = (await octokit.request("GET /user")).data as GitHubUser
    if (!ghUser.login) {
      throw new Error('Missing "login" in GitHub user response')
    }

    const redirectAfter = isValidRedirectUrl(statePayload.redirectAfter, APP_URL)
      ? statePayload.redirectAfter
      : `${APP_URL}/projects`

    const identity: AuthenticatedIdentity = {
      subject: `github:${ghUser.id}`,
      email: ghUser.email,
      displayName: ghUser.name ?? ghUser.login,
      provider: this.name,
      vcs: {
        provider: "github",
        id: String(ghUser.id),
        username: ghUser.login,
        profile: ghUser,
        accessToken: tokenData.access_token,
        installationId: statePayload.installationId,
      },
    }
    return { identity, redirectAfter }
  }
}
