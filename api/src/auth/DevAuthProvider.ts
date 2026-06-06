import { APP_URL, DEV_AUTH_EMAIL, IS_PRODUCTION } from "../environment"
import { isValidRedirectUrl } from "../http"
import type { DefaultRequest, DefaultResponse } from "../types"
import type { AuthProvider, AuthenticatedIdentity } from "./AuthProvider"

/**
 * Non-production auth provider that grants a single fixed identity without any external IdP.
 *
 * Intended for local development, CI, and air-gapped demos. It replaces the previous
 * `X-Test-User-Id` shortcut. Refuses to run in production.
 */
export class DevAuthProvider implements AuthProvider {
  readonly name = "dev"
  readonly interactive = false

  constructor() {
    if (IS_PRODUCTION) {
      throw new Error("DevAuthProvider must not be used in production (set AUTH_PROVIDER=oidc)")
    }
  }

  beginLogin(
    _req: DefaultRequest,
    _res: DefaultResponse,
    redirectAfter: string,
  ): Promise<{ redirectUrl: string }> {
    // No interactive step; send the browser straight to the callback to complete login.
    const redirect = isValidRedirectUrl(redirectAfter, APP_URL)
      ? redirectAfter
      : `${APP_URL}/projects`
    const url = new URL(`${APP_URL}/api/auth/callback`)
    url.searchParams.set("redirect", redirect)
    return Promise.resolve({ redirectUrl: url.href })
  }

  completeLogin(
    req: DefaultRequest,
    _res: DefaultResponse,
  ): Promise<{ identity: AuthenticatedIdentity; redirectAfter: string }> {
    const redirectParam = typeof req.query.redirect === "string" ? req.query.redirect : undefined
    const redirectAfter =
      redirectParam && isValidRedirectUrl(redirectParam, APP_URL)
        ? redirectParam
        : `${APP_URL}/projects`

    const email = DEV_AUTH_EMAIL || "dev@vizdiff.local"
    const identity: AuthenticatedIdentity = {
      subject: "dev",
      email,
      displayName: "Developer",
      provider: this.name,
    }
    return Promise.resolve({ identity, redirectAfter })
  }
}
