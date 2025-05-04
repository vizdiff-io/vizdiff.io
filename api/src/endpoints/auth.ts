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
  IS_PRODUCTION,
  JWT_SECRET,
  STRIPE_SECRET_KEY,
  STRIPE_API_VERSION,
} from "../environment"
import { syncUserInstallations, syncUserGithubRepos } from "../github"
import { isValidRedirectUrl, parseSimpleQueryString, requiredQueryString } from "../http"
import { log } from "../log"
import type { GithubUser } from "../schemas/GithubUser"
import type { DefaultRequest, DefaultResponse } from "../types"

const GITHUB_TOKEN_EXCHANGE = "https://github.com/login/oauth/access_token"

if (!GITHUB_CLIENT_ID) {
  throw new Error("Missing GITHUB_CLIENT_ID")
}
if (!GITHUB_CLIENT_SECRET) {
  throw new Error("Missing GITHUB_CLIENT_SECRET")
}
if (!GITHUB_APP_ID) {
  throw new Error("Missing GITHUB_APP_ID")
}
if (!GITHUB_PRIVATE_KEY) {
  throw new Error("Missing GITHUB_PRIVATE_KEY")
}
if (!APP_URL) {
  throw new Error("Missing APP_URL")
}

export async function githubAppInstalled(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const setupAction = requiredQueryString("setup_action", req)
  const installationId = requiredQueryString("installation_id", req)

  // Only proceed if this was a new installation
  if (setupAction !== "install") {
    res.redirect(APP_URL)
    return
  }

  // Start the OAuth flow to get user details, passing the installation_id
  const state = encodeURIComponent(
    `redirect=${encodeURIComponent(`${APP_URL}/projects`)}&installation_id=${installationId}`,
  )
  const callbackUri = encodeURIComponent(`${APP_URL}/api/auth/github/callback`)
  const scope = "read:user,user:email"
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${callbackUri}&scope=${scope}&state=${state}`
  res.redirect(authUrl)
}

export async function githubCallback(req: DefaultRequest, res: DefaultResponse): Promise<void> {
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
  if (!isValidRedirectUrl(finalRedirect)) {
    throw new Error(`Invalid redirect URL: ${finalRedirect}`)
  }

  // The request to GITHUB_TOKEN_EXCHANGE requires a `redirect_uri` parameter that matches the
  // `redirect_uri` parameter used in the initial request to GITHUB_AUTH_URL, i.e. this endpoint
  const callbackUri = `${APP_URL}/api/auth/github/callback`

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
