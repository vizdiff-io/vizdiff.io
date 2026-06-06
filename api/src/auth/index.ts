import { AUTH_PROVIDER } from "../environment"
import type { AuthProvider } from "./AuthProvider"
import { DevAuthProvider } from "./DevAuthProvider"
import { OidcAuthProvider } from "./OidcAuthProvider"

export type { AuthProvider, AuthenticatedIdentity } from "./AuthProvider"

let provider: AuthProvider | undefined

/**
 * Resolve the configured {@link AuthProvider} (singleton), selected by the `AUTH_PROVIDER` env var.
 *
 * Supported values:
 *  - `oidc` (default): generic OIDC / Microsoft Entra via {@link OidcAuthProvider}.
 *  - `dev`: non-production fixed identity via {@link DevAuthProvider}.
 *  - `custom`: reserved slot for a future custom auth service. To add it, implement the
 *    `AuthProvider` interface in `./CustomAuthProvider.ts` and return it from the case below.
 */
export function getAuthProvider(): AuthProvider {
  if (provider) {
    return provider
  }

  switch (AUTH_PROVIDER) {
    case "dev":
      provider = new DevAuthProvider()
      break
    case "oidc":
      provider = new OidcAuthProvider()
      break
    // case "custom":
    //   provider = new CustomAuthProvider()
    //   break
    default:
      throw new Error(`Unknown AUTH_PROVIDER "${AUTH_PROVIDER}". Supported values: "oidc", "dev".`)
  }

  return provider
}
