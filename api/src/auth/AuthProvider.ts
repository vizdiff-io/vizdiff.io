import type { DefaultRequest, DefaultResponse } from "../types"

/**
 * A verified identity returned by an {@link AuthProvider} after a successful login.
 *
 * `subject` is the stable, provider-issued unique identifier (OIDC `sub`) used to upsert the
 * VizDiff user record. It is the sole source of identity; email/displayName are informational.
 */
export interface AuthenticatedIdentity {
  subject: string
  email: string | null
  displayName: string | null
  provider: string
}

/**
 * Pluggable authentication provider. VizDiff decouples *identity* (who the user is) from the
 * existing JWT-cookie *session* mechanism — providers only resolve identity; the auth endpoints
 * issue the JWT cookie themselves.
 *
 * Implementations:
 *  - {@link OidcAuthProvider} — generic OIDC / Microsoft Entra (MSAL) via `openid-client`.
 *  - {@link DevAuthProvider}  — non-production fixed identity for local development / CI.
 *  - A future `custom` provider can wrap an internal corporate auth service (see auth/index.ts).
 */
export interface AuthProvider {
  /** Stable provider name, recorded on the User as `authProvider`. */
  readonly name: string
  /** Whether login requires an interactive browser redirect (OIDC) vs. immediate (dev). */
  readonly interactive: boolean

  /**
   * Begin a login flow. Returns the URL the browser should be redirected to in order to
   * authenticate. May set transient cookies on `res` (e.g. PKCE/state/nonce).
   */
  beginLogin(
    req: DefaultRequest,
    res: DefaultResponse,
    redirectAfter: string,
  ): Promise<{ redirectUrl: string }>

  /**
   * Complete a login flow from the provider's callback. Validates the response and returns the
   * verified identity plus the post-login redirect target carried through the flow.
   */
  completeLogin(
    req: DefaultRequest,
    res: DefaultResponse,
  ): Promise<{ identity: AuthenticatedIdentity; redirectAfter: string }>

  /** Optional IdP logout (single sign-out) URL. */
  logoutUrl?(req: DefaultRequest): string | undefined
}
