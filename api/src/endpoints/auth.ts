import { fetch } from "undici"
import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, JWT_SECRET } from "../environment"
import { Database } from "../database"
import { User } from "../entity/User"
import { GithubUser } from "../schemas/GithubUser"
import jwt from "jsonwebtoken"
import { getCookieString, getQueryString } from "../http"
import { DefaultRequest, DefaultResponse } from "../types"
import { log } from "../log"

const GITHUB_TOKEN_EXCHANGE = "https://github.com/login/oauth/access_token"
const GITHUB_USER_INFO = "https://api.github.com/user"

if (!GITHUB_CLIENT_ID) {
  throw new Error("Missing GITHUB_CLIENT_ID")
}
if (!GITHUB_CLIENT_SECRET) {
  throw new Error("Missing GITHUB_CLIENT_SECRET")
}

export async function auth(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const code = getQueryString("code", req)
  const redirectUri = getQueryString("redirect_uri", req)
  const receivedState = getQueryString("state", req)
  const storedState = getCookieString("state", req)
  if (receivedState !== storedState) {
    throw new Error("Invalid state")
  }

  // Exchange the code for an access token
  log.debug(`Exchanging GitHub code for access token for ${req.ip}`)
  const ghRes = await fetch(GITHUB_TOKEN_EXCHANGE, {
    method: "POST",
    body: new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
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
    throw new Error(`Failed to GET ${GITHUB_USER_INFO}`)
  }
  const ghUser = (await ghUserRes.json()) as GithubUser
  if (!ghUser.login) {
    throw new Error(`Missing "login" in response from ${GITHUB_USER_INFO}`)
  }

  // Check if the user already exists
  const db = await Database()
  const userTable = db.getRepository(User)
  let user = await userTable.findOneBy({ githubId: BigInt(ghUser.id) })
  if (!user) {
    // Create a new user
    log.info(`Creating new user for GitHub user ${ghUser.login} (${ghUser.id})`)
    user = new User()
    user.githubId = BigInt(ghUser.id)
  }

  // Set or update the user's info retrieved from GitHub
  user.email = ghUser.email
  user.githubUsername = ghUser.login
  user.githubProfile = JSON.stringify(ghUser)
  user.githubAccessToken = accessToken
  user = await userTable.save(user)

  // Update or create the user row in the database
  log.debug(`Saving user ${user.id} to the database`)
  await userTable.save(user)

  // Generate a JWT
  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "1h" })

  // Send the token to the client as a secure HttpOnly cookie
  res.cookie("token", token, {
    httpOnly: true,
    secure: req.secure ? true : undefined,
    sameSite: "strict",
    maxAge: 60 * 60 * 1000, // 1 hour in milliseconds
  })

  // Redirect to the original URL
  res.redirect(redirectUri)
}
