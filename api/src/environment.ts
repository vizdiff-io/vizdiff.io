import { config as configEnv } from "dotenv-flow"
import * as path from "path"
import { fileURLToPath } from "url"

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const envPath = path.join(dirname, "..")

// Load the `api/.env*` file into process.env
configEnv({
  path: envPath,
  default_node_env: "development",
  silent: process.env.NODE_ENV === "test",
})

export const IS_PRODUCTION = process.env.NODE_ENV === "production"
export const IS_STAGING = process.env.NODE_ENV === "staging"
export const IS_TEST = process.env.NODE_ENV === "test"
// Allow VCS status posting in dev mode for testing
export const ENABLE_VCS_STATUS =
  process.env.ENABLE_VCS_STATUS != undefined
    ? process.env.ENABLE_VCS_STATUS === "true"
    : IS_PRODUCTION || IS_STAGING

export const PORT = parseInt(process.env.PORT ?? "") || (IS_TEST ? 3002 : 3001)

// ---------------------------------------------------------------------------
// Authentication (pluggable AuthProvider)
// ---------------------------------------------------------------------------
// Identity provider selection: "oidc" (default) or "dev" (non-production only).
export const AUTH_PROVIDER = process.env.AUTH_PROVIDER ?? (IS_PRODUCTION ? "oidc" : "dev")

// OIDC / MSAL settings (used when AUTH_PROVIDER=oidc)
export const OIDC_ISSUER = process.env.OIDC_ISSUER ?? ""
export const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID ?? ""
export const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET ?? ""
export const OIDC_REDIRECT_URI = process.env.OIDC_REDIRECT_URI ?? ""
export const OIDC_SCOPES = process.env.OIDC_SCOPES ?? "openid profile email"
// Escape hatch for self-signed IdPs (mirrors GITLAB_REJECT_UNAUTHORIZED).
export const OIDC_REJECT_UNAUTHORIZED = process.env.OIDC_REJECT_UNAUTHORIZED !== "false"

// Dev auth provider fixed identity email (used when AUTH_PROVIDER=dev)
export const DEV_AUTH_EMAIL = process.env.DEV_AUTH_EMAIL ?? ""

// ---------------------------------------------------------------------------
// GitHub (disabled by default; gated by GITHUB_ENABLED)
// ---------------------------------------------------------------------------
export const GITHUB_ENABLED = process.env.GITHUB_ENABLED === "true"
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? ""
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? ""
export const GITHUB_APP_ID = process.env.GITHUB_APP_ID ?? ""
export const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? ""
export const GITHUB_PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY ?? ""

// ---------------------------------------------------------------------------
// GitLab (configured per-host service tokens; see shared/gitlabHosts.ts)
// ---------------------------------------------------------------------------
// Default host used for webhook fallback and project creation when a payload origin is unavailable.
export const GITLAB_HOST = process.env.GITLAB_HOST ?? "https://gitlab.com"
export const GITLAB_WEBHOOK_SECRET = process.env.GITLAB_WEBHOOK_SECRET ?? ""

export const APP_URL = process.env.APP_URL ?? "https://vizdiff.io"

export const POSTGRES_USER = process.env.POSTGRES_USER ?? "postgres"
export const POSTGRES_HOST = process.env.POSTGRES_HOST ?? "localhost"
export const POSTGRES_DATABASE = process.env.POSTGRES_DATABASE ?? "vizdiff"
export const POSTGRES_PASS = process.env.POSTGRES_PASS ?? "postgres"
export const POSTGRES_PORT = parseInt(process.env.POSTGRES_PORT ?? "5432")

export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME ?? "vizdiffio-testing"

// Optional custom S3 endpoint for non-AWS object stores (e.g. MinIO in standalone/air-gapped
// mode). When unset, the AWS SDK uses the real S3 endpoint. Path-style addressing defaults on
// whenever a custom endpoint is set (MinIO requires it) and can be overridden explicitly.
export const S3_ENDPOINT = process.env.S3_ENDPOINT
export const S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE
  ? process.env.S3_FORCE_PATH_STYLE === "true"
  : Boolean(S3_ENDPOINT)
// Extra options spread into `new S3Client(...)`; empty object for real AWS S3.
export const S3_CLIENT_CONFIG: { endpoint?: string; forcePathStyle?: boolean } = S3_ENDPOINT
  ? { endpoint: S3_ENDPOINT, forcePathStyle: S3_FORCE_PATH_STYLE }
  : {}

export const JWT_SECRET = process.env.JWT_SECRET ?? "secret"
