import { Express, Request } from "express"
import { fetch } from "undici"
import { ParsedQs } from "qs"
import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, JWT_SECRET } from "../environment"
import { Database } from "../database"
import { User } from "../entity/User"
import { GithubUser } from "../schemas/GithubUser"
import jwt from "jsonwebtoken"

const GITHUB_TOKEN_EXCHANGE = "https://github.com/login/oauth/access_token"
const GITHUB_USER_INFO = "https://api.github.com/user"

if (!GITHUB_CLIENT_ID) {
  throw new Error("Missing GITHUB_CLIENT_ID")
}
if (!GITHUB_CLIENT_SECRET) {
  throw new Error("Missing GITHUB_CLIENT_SECRET")
}

type RequestWithQuery = Request<{}, any, any, ParsedQs, Record<string, any>>

export const auth = (app: Express) => {
  // GitHub OAuth callback
  app.get("/auth/github/callback", async (req, res) => {
    const code = getQueryString("code", req)
    const redirectUri = getQueryString("redirect_uri", req)
    const receivedState = getQueryString("state", req)
    const storedState = getCookieString("state", req)
    if (receivedState !== storedState) {
      throw new Error("Invalid state")
    }

    // Exchange the code for an access token
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

    // Save the user to the database
    const db = await Database()
    const userTable = db.getRepository(User)
    let user = new User()
    user.githubId = BigInt(ghUser.id)
    user.email = ghUser.email
    user.githubUsername = ghUser.login
    user.githubProfile = JSON.stringify(ghUser)
    user.githubAccessToken = accessToken
    user = await userTable.save(user)

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
  })
}

function getQueryString(key: string, req: RequestWithQuery): string {
  const maybeValue = req.query[key]
  if (!maybeValue || typeof maybeValue !== "string") {
    throw new Error(`Missing query parameter "${key}"`)
  }
  return maybeValue
}

function getCookieString(key: string, req: RequestWithQuery): string {
  const maybeValue = req.cookies[key]
  if (!maybeValue || typeof maybeValue !== "string") {
    throw new Error(`Missing cookie "${key}"`)
  }
  return maybeValue
}
