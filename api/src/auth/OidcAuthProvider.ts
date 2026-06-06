import jwt from "jsonwebtoken"
import * as oidc from "openid-client"

import {
  APP_URL,
  IS_PRODUCTION,
  JWT_SECRET,
  OIDC_CLIENT_ID,
  OIDC_CLIENT_SECRET,
  OIDC_ISSUER,
  OIDC_REDIRECT_URI,
  OIDC_REJECT_UNAUTHORIZED,
  OIDC_SCOPES,
} from "../environment"
import { isValidRedirectUrl } from "../http"
import { log } from "../log"
import type { DefaultRequest, DefaultResponse } from "../types"
import type { AuthProvider, AuthenticatedIdentity } from "./AuthProvider"

// Transient cookie carrying the signed PKCE/nonce/state across the OIDC redirect. Signed with
// JWT_SECRET so the deployment stays stateless (no server-side session store needed for Helm).
const STATE_COOKIE = "oidc_state"
const STATE_TTL_SECONDS = 600 // 10 minutes

interface OidcStatePayload {
  codeVerifier: string
  nonce: string
  state: string
  redirectAfter: string
}

interface IdTokenClaims {
  sub: string
  email?: string
  name?: string
  preferred_username?: string
  [key: string]: unknown
}

export class OidcAuthProvider implements AuthProvider {
  readonly name = "oidc"
  readonly interactive = true

  #configPromise: Promise<oidc.Configuration> | undefined

  constructor() {
    if (!OIDC_ISSUER || !OIDC_CLIENT_ID) {
      throw new Error(
        "OIDC auth provider requires OIDC_ISSUER and OIDC_CLIENT_ID to be configured. " +
          "OIDC_CLIENT_SECRET is required for confidential clients.",
      )
    }
  }

  get #redirectUri(): string {
    return OIDC_REDIRECT_URI || `${APP_URL}/api/auth/callback`
  }

  /** Lazily discover the issuer metadata (cached for the process lifetime). */
  async #getConfig(): Promise<oidc.Configuration> {
    this.#configPromise ??= (async () => {
      // Escape hatch for self-signed IdPs (mirrors GitLab's rejectUnauthorized handling).
      // `allowInsecureRequests` is intentionally used here only when OIDC_REJECT_UNAUTHORIZED=false.
      const execute = OIDC_REJECT_UNAUTHORIZED
        ? undefined
        : // eslint-disable-next-line @typescript-eslint/no-deprecated
          [oidc.allowInsecureRequests]
      // Confidential clients authenticate the token exchange with the client secret. v6 defaults
      // to ClientSecretPost when a client_secret is present, but we pass it explicitly so the
      // intent is unambiguous (and public clients with no secret stay unauthenticated).
      const clientAuth = OIDC_CLIENT_SECRET ? oidc.ClientSecretPost(OIDC_CLIENT_SECRET) : undefined
      const config = await oidc.discovery(
        new URL(OIDC_ISSUER),
        OIDC_CLIENT_ID,
        OIDC_CLIENT_SECRET || undefined,
        clientAuth,
        execute ? { execute } : undefined,
      )
      if (!OIDC_REJECT_UNAUTHORIZED) {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        oidc.allowInsecureRequests(config)
      }
      return config
    })()
    return await this.#configPromise
  }

  async beginLogin(
    _req: DefaultRequest,
    res: DefaultResponse,
    redirectAfter: string,
  ): Promise<{ redirectUrl: string }> {
    const config = await this.#getConfig()

    const codeVerifier = oidc.randomPKCECodeVerifier()
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier)
    const nonce = oidc.randomNonce()
    const state = oidc.randomState()

    const statePayload: OidcStatePayload = { codeVerifier, nonce, state, redirectAfter }
    const stateToken = jwt.sign(statePayload, JWT_SECRET, { expiresIn: STATE_TTL_SECONDS })
    res.cookie(STATE_COOKIE, stateToken, {
      httpOnly: true,
      secure: IS_PRODUCTION ? true : undefined,
      sameSite: "lax",
      maxAge: STATE_TTL_SECONDS * 1000,
      path: "/",
    })

    const scope = OIDC_SCOPES || "openid profile email"
    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: this.#redirectUri,
      scope,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      nonce,
    })

    return { redirectUrl: url.href }
  }

  async completeLogin(
    req: DefaultRequest,
    res: DefaultResponse,
  ): Promise<{ identity: AuthenticatedIdentity; redirectAfter: string }> {
    const config = await this.#getConfig()

    const stateToken = req.cookies[STATE_COOKIE] as string | undefined
    if (!stateToken) {
      throw new Error("Missing OIDC state cookie; login flow expired or cookies are blocked")
    }

    let statePayload: OidcStatePayload
    try {
      statePayload = jwt.verify(stateToken, JWT_SECRET) as OidcStatePayload
    } catch (err) {
      log.warn(`OIDC state cookie verification failed: ${String(err)}`)
      throw new Error("Invalid or expired OIDC state")
    }

    // Clear the transient state cookie regardless of outcome.
    res.clearCookie(STATE_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" })

    // Reconstruct the full callback URL the IdP redirected back to.
    const currentUrl = new URL(this.#redirectUri)
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === "string") {
        currentUrl.searchParams.set(key, value)
      }
    }

    // Validates the authorization code, exchanges it for tokens, and verifies the ID token
    // signature, issuer, audience, expiry, state, and nonce via the discovered JWKS.
    const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: statePayload.codeVerifier,
      expectedNonce: statePayload.nonce,
      expectedState: statePayload.state,
    })

    const claims = tokens.claims() as IdTokenClaims | undefined
    if (!claims?.sub) {
      throw new Error("OIDC ID token is missing the required `sub` claim")
    }

    const identity: AuthenticatedIdentity = {
      subject: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
      displayName:
        (typeof claims.name === "string" ? claims.name : undefined) ??
        (typeof claims.preferred_username === "string" ? claims.preferred_username : undefined) ??
        null,
      provider: this.name,
    }

    // Defensive: ensure the redirect target is on our origin before honoring it.
    const redirectAfter = isValidRedirectUrl(statePayload.redirectAfter, APP_URL)
      ? statePayload.redirectAfter
      : `${APP_URL}/projects`

    return { identity, redirectAfter }
  }
}
