import { Octokit } from "@octokit/rest"
import jwt from "jsonwebtoken"
import { User } from "shared"
import { Stripe } from "stripe"
import { fetch } from "undici"

import { identifyUser } from "../customerio"
import { Database } from "../database"
import {
  APP_URL,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_APP_ID,
  GITHUB_PRIVATE_KEY,
  GITLAB_HOST,
  GITLAB_CLIENT_ID,
  GITLAB_CLIENT_SECRET,
  IS_PRODUCTION,
  JWT_SECRET,
  STRIPE_SECRET_KEY,
  STRIPE_API_VERSION,
} from "../environment"
import { syncUserInstallations, syncUserGithubRepos } from "../github"
import { syncUserGitLabGroups, syncUserGitLabProjects } from "../gitlab"
import { isValidRedirectUrl, parseSimpleQueryString, requiredQueryString } from "../http"
import { log } from "../log"
import type { GithubUser } from "../schemas/GithubUser"
import type { DefaultRequest, DefaultResponse } from "../types"

const GITHUB_TOKEN_EXCHANGE = "https://github.com/login/oauth/access_token"

// GitLab user profile type
interface GitLabUser {
  id: number
  username: string
  email: string | null
  name: string | null
  avatar_url: string | null
  web_url: string
  state: string
}

// Require at least one VCS provider (GitHub or GitLab) for OAuth
const hasGitHub =
  !!(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET && GITHUB_APP_ID && GITHUB_PRIVATE_KEY)
const hasGitLab = !!(GITLAB_CLIENT_ID && GITLAB_CLIENT_SECRET)

if (!hasGitHub && !hasGitLab) {
  throw new Error(
    "At least one VCS provider must be configured. " +
      "For GitHub: set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_APP_ID, GITHUB_PRIVATE_KEY. " +
      "For GitLab: set GITLAB_CLIENT_ID, GITLAB_CLIENT_SECRET.",
  )
}

if (!APP_URL) {
  throw new Error("Missing APP_URL")
}

/**
 * Get the origin (protocol + host) from the request, supporting proxies and ngrok.
 * Falls back to APP_URL if headers are not available.
 */
function getRequestOrigin(req: DefaultRequest): string {
  // Check for X-Forwarded-Proto and X-Forwarded-Host (used by proxies/ngrok)
  const forwardedProto = req.headers["x-forwarded-proto"] as string | undefined
  const forwardedHost = req.headers["x-forwarded-host"] as string | undefined

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  // Check for Host header (standard)
  const host = req.headers.host
  if (host) {
    // Determine protocol from request
    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http"
    return `${protocol}://${host}`
  }

  // Fallback to APP_URL
  return APP_URL
}

export async function githubAppInstalled(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET || !GITHUB_APP_ID || !GITHUB_PRIVATE_KEY) {
    res.status(500).json({ error: "GitHub OAuth not configured" })
    return
  }

  const setupAction = requiredQueryString("setup_action", req)
  const installationId = requiredQueryString("installation_id", req)

  // Only proceed if this was a new installation
  if (setupAction !== "install") {
    const requestOrigin = getRequestOrigin(req)
    res.redirect(requestOrigin)
    return
  }

  // Start the OAuth flow to get user details, passing the installation_id
  // Use the request origin to support dynamic URLs (e.g., ngrok)
  const requestOrigin = getRequestOrigin(req)
  const state = encodeURIComponent(
    `redirect=${encodeURIComponent(`${requestOrigin}/projects`)}&installation_id=${installationId}`,
  )
  const callbackUri = encodeURIComponent(`${requestOrigin}/api/auth/github/callback`)
  const scope = "read:user,user:email"
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${callbackUri}&scope=${scope}&state=${state}`
  res.redirect(authUrl)
}

export async function githubCallback(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    res.status(500).json({ error: "GitHub OAuth not configured" })
    return
  }

  const code = requiredQueryString("code", req)

  // Handle both direct app installation callback and OAuth callback
  let installationId: number | undefined
  let finalRedirect: string | undefined

  // If we have state, parse it (OAuth flow)
  const state = req.query.state as string | undefined
  if (state) {
    const stateValues = parseSimpleQueryString(state)
    finalRedirect = stateValues.get("redirect")
    const stateInstallId = stateValues.get("installation_id")
    if (stateInstallId) {
      installationId = parseInt(stateInstallId, 10)
    }
  }

  // If we have installation_id in query params (direct app installation), use that
  const queryInstallId = req.query.installation_id as string | undefined
  if (queryInstallId) {
    installationId = parseInt(queryInstallId, 10)
    // Default redirect for app installation flow
    finalRedirect = finalRedirect ?? `${APP_URL}/projects`
  }

  finalRedirect ??= `${APP_URL}/projects` // Default fallback

  // The request to GITHUB_TOKEN_EXCHANGE requires a `redirect_uri` parameter that matches the
  // `redirect_uri` parameter used in the initial request to GITHUB_AUTH_URL, i.e. this endpoint
  // Use the request origin to support dynamic URLs (e.g., ngrok)
  const requestOrigin = getRequestOrigin(req)

  // Validate redirect URL against the request origin to support dynamic URLs (e.g., ngrok)
  if (!isValidRedirectUrl(finalRedirect, requestOrigin)) {
    throw new Error(`Invalid redirect URL: ${finalRedirect}`)
  }
  const callbackUri = `${requestOrigin}/api/auth/github/callback`

  // Exchange the code for an access token
  log.debug(`Exchanging GitHub code for access token for ${req.ip} (redirect_uri=${callbackUri})`)
  const ghRes = await fetch(GITHUB_TOKEN_EXCHANGE, {
    method: "POST",
    body: new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: callbackUri,
    }),
    headers: {
      Accept: "application/json",
    },
  })
  if (!ghRes.ok) {
    throw new Error(`Failed to POST ${GITHUB_TOKEN_EXCHANGE}`)
  }

  // Get the user's profile using OAuth token first
  const ghTokenRes = (await ghRes.json()) as { access_token?: string }
  if (!ghTokenRes.access_token) {
    throw new Error("Missing access_token in GitHub response")
  }
  const octokit = new Octokit({ auth: ghTokenRes.access_token })

  // Get the user's profile
  log.debug(`GitHub OAuth authenticated for ${req.ip}, retrieving user info`)
  const ghUserRes = await octokit.request("GET /user")
  const ghUser = ghUserRes.data as GithubUser
  if (!ghUser.login) {
    const json = JSON.stringify(ghUser)
    log.error(`GitHub user response did not contain "login": ${json}`)
    throw new Error(`Missing "login" in GitHub user response`)
  }
  const githubId = String(ghUser.id)

  // Check if the user already exists
  const db = await Database()
  const userTable = db.getRepository(User)
  let user = await userTable.findOneBy({ githubId })
  if (!user) {
    // Create a new user
    log.info(
      { event: "user_created", githubUser: ghUser },
      `Creating new user for GitHub user ${ghUser.login} (${ghUser.id})`,
    )
    user = new User()
    user.githubId = githubId
  }

  // Set or update the user's info retrieved from GitHub
  user.email = ghUser.email
  user.githubUsername = ghUser.login
  user.githubProfile = ghUser
  user.githubAccessToken = ghTokenRes.access_token

  user = await userTable.save(user)

  // Ensure user has a Stripe customer ID
  if (STRIPE_SECRET_KEY && !user.stripeCustomerId) {
    try {
      log.debug(`Creating Stripe customer for GitHub user ${ghUser.login} (${ghUser.id})`)
      const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION })
      const customer = await stripe.customers.create({
        email: ghUser.email ?? undefined,
        name: ghUser.name ?? ghUser.login,
        metadata: {
          github_id: githubId,
          github_username: ghUser.login,
          user_id: user.id.toString(),
        },
        description: `GitHub user: ${ghUser.login}`,
      })

      user.stripeCustomerId = customer.id
      log.info(`Created Stripe customer ${customer.id} for GitHub user ${ghUser.login}`)

      // Update the user record with the customer ID
      user = await userTable.save(user)
    } catch (error) {
      // Don't block user creation if Stripe fails
      log.error(error, `Failed to create Stripe customer for GitHub user ${ghUser.login}`)
    }
  }

  // Sync GitHub App installations for this user, passing the installation ID if available
  await syncUserInstallations(user, installationId)

  // Sync GitHub repositories that this user has access to (asynchronously)
  syncUserGithubRepos(user)
    .catch((error: unknown) => {
      log.error(
        error,
        `Failed to sync GitHub repos for user ${user.id} (${user.githubUsername}) after creation`,
      )
    })
    .finally(() => {
      // Identify the user with Customer.io
      identifyUser(user, req)
    })

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

  // Append a `signed_in` query param to the redirect URL so we can track the user's sign-in
  const url = new URL(finalRedirect)
  url.searchParams.set("signed_in", "true")
  finalRedirect = url.toString()

  // Redirect to the original URL
  res.redirect(finalRedirect)
}

export async function logout(req: DefaultRequest, res: DefaultResponse): Promise<void> {
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
  res.redirect(APP_URL)
}

// ============================================================================
// GitLab OAuth Flow
// ============================================================================

/**
 * Initiates the GitLab OAuth flow by redirecting to GitLab's authorization page.
 * This is called when a user clicks "Sign in with GitLab".
 */
export async function gitlabLogin(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  if (!GITLAB_CLIENT_ID) {
    res.status(500).json({ error: "GitLab OAuth not configured" })
    return
  }

  // Use the request origin to support dynamic URLs (e.g., ngrok)
  const requestOrigin = getRequestOrigin(req)

  // Get the redirect URL from query params (where to send user after auth)
  const redirect =
    (typeof req.query.redirect === "string" ? req.query.redirect : undefined) ??
    `${requestOrigin}/projects`

  // Build the state parameter with redirect info
  const state = encodeURIComponent(`redirect=${encodeURIComponent(redirect)}`)

  // Build the callback URI (must match exactly in gitlabCallback for OAuth token exchange)
  const callbackUri = encodeURIComponent(`${requestOrigin}/api/auth/gitlab/callback`)

  // GitLab OAuth scopes needed for our integration:
  // - read_user: Access user profile info
  // - read_api: Read API resources (groups, projects)
  // - read_repository: Read repository data
  // - api: Full API access (needed for commit status updates)
  const scope = encodeURIComponent("read_user read_api api")

  // Redirect to GitLab's authorization page
  const authUrl =
    `${GITLAB_HOST}/oauth/authorize?` +
    `client_id=${GITLAB_CLIENT_ID}` +
    `&redirect_uri=${callbackUri}` +
    `&response_type=code` +
    `&scope=${scope}` +
    `&state=${state}`

  res.redirect(authUrl)
}

/**
 * Handles the GitLab OAuth callback after user authorizes the application.
 */
export async function gitlabCallback(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  if (!GITLAB_CLIENT_ID || !GITLAB_CLIENT_SECRET) {
    res.status(500).json({ error: "GitLab OAuth not configured" })
    return
  }

  const code = requiredQueryString("code", req)

  // Parse state to get redirect URL
  let finalRedirect: string | undefined
  const state = req.query.state as string | undefined
  if (state) {
    const stateValues = parseSimpleQueryString(state)
    finalRedirect = stateValues.get("redirect")
  }

  finalRedirect ??= `${APP_URL}/projects`

  // Use the request origin to support dynamic URLs (e.g., ngrok)
  const requestOrigin = getRequestOrigin(req)

  // Validate redirect URL against the request origin to support dynamic URLs (e.g., ngrok)
  if (!isValidRedirectUrl(finalRedirect, requestOrigin)) {
    throw new Error(`Invalid redirect URL: ${finalRedirect}`)
  }

  const callbackUri = `${requestOrigin}/api/auth/gitlab/callback`

  // Exchange the authorization code for access token
  log.debug(`Exchanging GitLab code for access token for ${req.ip}`)
  const tokenRes = await fetch(`${GITLAB_HOST}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: GITLAB_CLIENT_ID,
      client_secret: GITLAB_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: callbackUri,
    }),
  })

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text()
    log.error(`GitLab token exchange failed: ${errorText}`)
    throw new Error(`Failed to exchange GitLab code for token: ${tokenRes.status}`)
  }

  const tokenData = (await tokenRes.json()) as {
    access_token?: string
    refresh_token?: string
    token_type?: string
    expires_in?: number
  }

  if (!tokenData.access_token) {
    throw new Error("Missing access_token in GitLab response")
  }

  // Fetch user profile from GitLab
  log.debug(`GitLab OAuth authenticated for ${req.ip}, retrieving user info`)
  const userRes = await fetch(`${GITLAB_HOST}/api/v4/user`, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/json",
    },
  })

  if (!userRes.ok) {
    throw new Error(`Failed to fetch GitLab user profile: ${userRes.status}`)
  }

  const glUser = (await userRes.json()) as GitLabUser
  if (!glUser.username) {
    const json = JSON.stringify(glUser)
    log.error(`GitLab user response did not contain "username": ${json}`)
    throw new Error('Missing "username" in GitLab user response')
  }

  const gitlabId = String(glUser.id)

  // Check if user already exists with this GitLab ID
  const db = await Database()
  const userTable = db.getRepository(User)
  let user = await userTable.findOneBy({ gitlabId })

  if (!user) {
    // Create a new user
    // Note: We do NOT link accounts by email address to prevent account takeover attacks.
    // Users must explicitly link accounts through a verified process if needed.
    log.info(
      { event: "user_created", gitlabUser: glUser },
      `Creating new user for GitLab user ${glUser.username} (${glUser.id})`,
    )
    user = new User()
  }

  // Set or update the user's GitLab info
  user.gitlabId = gitlabId
  user.gitlabUsername = glUser.username
  user.gitlabProfile = glUser
  user.gitlabAccessToken = tokenData.access_token
  user.gitlabRefreshToken = tokenData.refresh_token ?? null
  user.gitlabHost = GITLAB_HOST

  // Set email if not already set
  if (!user.email && glUser.email) {
    user.email = glUser.email
  }

  user = await userTable.save(user)

  // Ensure user has a Stripe customer ID
  if (STRIPE_SECRET_KEY && !user.stripeCustomerId) {
    try {
      log.debug(`Creating Stripe customer for GitLab user ${glUser.username} (${glUser.id})`)
      const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION })
      const customer = await stripe.customers.create({
        email: glUser.email ?? undefined,
        name: glUser.name ?? glUser.username,
        metadata: {
          gitlab_id: gitlabId,
          gitlab_username: glUser.username,
          user_id: user.id.toString(),
        },
        description: `GitLab user: ${glUser.username}`,
      })

      user.stripeCustomerId = customer.id
      log.info(`Created Stripe customer ${customer.id} for GitLab user ${glUser.username}`)

      user = await userTable.save(user)
    } catch (error) {
      log.error(error, `Failed to create Stripe customer for GitLab user ${glUser.username}`)
    }
  }

  // Sync GitLab groups for this user
  await syncUserGitLabGroups(user)

  // Sync GitLab projects that this user has access to (asynchronously)
  syncUserGitLabProjects(user)
    .catch((error: unknown) => {
      log.error(
        error,
        `Failed to sync GitLab projects for user ${user.id} (${user.gitlabUsername}) after creation`,
      )
    })
    .finally(() => {
      // Identify the user with Customer.io
      identifyUser(user, req)
    })

  // Generate a JWT
  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "8h" })

  // Set secure cookies
  const domain = new URL(APP_URL).hostname
  res.cookie("token", token, {
    domain,
    httpOnly: true,
    secure: IS_PRODUCTION || req.secure ? true : undefined,
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    path: "/",
  })
  res.cookie("authenticated", "true", {
    domain,
    httpOnly: false,
    secure: false,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: "/",
  })

  // Append signed_in query param for tracking
  const url = new URL(finalRedirect)
  url.searchParams.set("signed_in", "true")
  finalRedirect = url.toString()

  res.redirect(finalRedirect)
}
