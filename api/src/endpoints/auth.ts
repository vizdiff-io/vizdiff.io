import jwt from "jsonwebtoken"
import { User } from "shared"
import { fetch } from "undici"

import { Database } from "../database"
import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, IS_PRODUCTION, JWT_SECRET } from "../environment"
import { parseSimpleQueryString, requiredQueryString } from "../http"
import { log } from "../log"
import { GithubUser } from "../schemas/GithubUser"
import { DefaultRequest, DefaultResponse } from "../types"

const GITHUB_TOKEN_EXCHANGE = "https://github.com/login/oauth/access_token"
const GITHUB_USER_INFO = "https://api.github.com/user"

if (!GITHUB_CLIENT_ID) {
  throw new Error("Missing GITHUB_CLIENT_ID")
}
if (!GITHUB_CLIENT_SECRET) {
  throw new Error("Missing GITHUB_CLIENT_SECRET")
}

export async function githubCallback(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const code = requiredQueryString("code", req)
  const receivedState = requiredQueryString("state", req)
  // NOTE: The API endpoints and frontend must be served from the same host for this to work
  // const storedState = requiredCookieString("auth_state", req)
  // if (receivedState !== storedState) {
  //   log.error(`Received state "${receivedState}" does not match cookie state "${storedState}"`)
  //   throw new Error("Invalid state")
  // }
  const stateValues = parseSimpleQueryString(receivedState)
  const finalRedirect = stateValues.get("redirect")
  if (!finalRedirect) {
    throw new Error("Missing redirect in state")
  }

  // The request to GITHUB_TOKEN_EXCHANGE requires a `redirect_uri` parameter that matches the
  // `redirect_uri` parameter used in the initial request to GITHUB_AUTH_URL, i.e. this endpoint
  const endpointUri = new URL(
    req.url,
    `${req.secure ? "https" : "http"}://${req.hostname}`,
  ).toString()

  // Exchange the code for an access token
  log.debug(`Exchanging GitHub code for access token for ${req.ip} (redirect_uri=${endpointUri})`)
  const ghRes = await fetch(GITHUB_TOKEN_EXCHANGE, {
    method: "POST",
    body: new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: endpointUri,
    }),
    headers: {
      Accept: "application/json",
    },
  })
  if (!ghRes.ok) {
    throw new Error(`Failed to POST ${GITHUB_TOKEN_EXCHANGE}`)
  }
  const ghBody = (await ghRes.json()) as { access_token?: string }
  if (!ghBody.access_token) {
    const json = JSON.stringify(ghBody)
    log.error(`Response from ${GITHUB_TOKEN_EXCHANGE} did not contain an access_token: ${json}`)
    throw new Error(`Missing access_token in response from ${GITHUB_TOKEN_EXCHANGE}`)
  }
  const accessToken = ghBody.access_token

  // Use the access token to get the user's profile
  log.debug(`GitHub access token acquired for ${req.ip}, retrieving user info`)
  const ghUserRes = await fetch(GITHUB_USER_INFO, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (!ghUserRes.ok) {
    log.error(`Failed to GET ${GITHUB_USER_INFO}: ${ghUserRes.status} ${ghUserRes.statusText}`)
    throw new Error(`Failed to GET ${GITHUB_USER_INFO}`)
  }
  const ghUser = (await ghUserRes.json()) as GithubUser
  if (!ghUser.login) {
    const json = JSON.stringify(ghUser)
    log.error(`Response from ${GITHUB_USER_INFO} did not contain "login": ${json}`)
    throw new Error(`Missing "login" in response from ${GITHUB_USER_INFO}`)
  }
  const githubId = String(ghUser.id)

  // Check if the user already exists
  const db = await Database()
  const userTable = db.getRepository(User)
  let user = await userTable.findOneBy({ githubId })
  if (!user) {
    // Create a new user
    log.info(`Creating new user for GitHub user ${ghUser.login} (${ghUser.id})`)
    user = new User()
    user.githubId = githubId
  }

  // Set or update the user's info retrieved from GitHub
  user.email = ghUser.email
  user.githubUsername = ghUser.login
  user.githubProfile = JSON.stringify(ghUser)
  user.githubAccessToken = accessToken
  user = await userTable.save(user)

  // Update or create the user row in the database
  log.debug(`Writing user info for ${user.id} (${user.githubUsername}) to the database`)
  await userTable.save(user)

  // Generate a JWT
  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "1h" })

  res.cookie("token", token, {
    secure: IS_PRODUCTION || req.secure ? true : undefined,
    sameSite: "lax",
    maxAge: 60 * 60 * 1000, // 1 hour in milliseconds
    domain: req.hostname,
  })

  // Redirect to the original URL
  res.redirect(finalRedirect)
}

export async function logout(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  res.clearCookie("token", {
    secure: IS_PRODUCTION || req.secure ? true : undefined,
    sameSite: "lax",
    domain: req.hostname,
  })
  res.redirect("/")
}
