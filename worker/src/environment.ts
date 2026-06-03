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
// Allow VCS status posting in dev mode for testing (defaults to true in prod/staging)
export const ENABLE_VCS_STATUS =
  process.env.ENABLE_VCS_STATUS != undefined
    ? process.env.ENABLE_VCS_STATUS === "true"
    : IS_PRODUCTION || IS_STAGING

export const POSTGRES_USER = process.env.POSTGRES_USER ?? "postgres"
export const POSTGRES_HOST = process.env.POSTGRES_HOST ?? "localhost"
export const POSTGRES_DATABASE = process.env.POSTGRES_DATABASE ?? "vizdiff"
export const POSTGRES_PASS = process.env.POSTGRES_PASS ?? "postgres"
export const POSTGRES_PORT = parseInt(process.env.POSTGRES_PORT ?? "5432", 10)

export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME ?? "vizdiffio-testing"

// GitHub support is disabled by default in self-hosted deployments.
export const GITHUB_ENABLED = process.env.GITHUB_ENABLED === "true"

// GitHub API settings (only used when GITHUB_ENABLED)
export const GITHUB_APP_ID = process.env.GITHUB_APP_ID ?? ""
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? ""
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? ""
export const GITHUB_PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY ?? ""
export const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? ""

// GitLab API settings.
// Per-host service tokens are configured via GITLAB_HOSTS (parsed in gitlab.ts via shared/gitlabHosts).
// GITLAB_HOST is the default host used to resolve a token when a task carries no explicit host.
export const GITLAB_HOST = process.env.GITLAB_HOST ?? "https://gitlab.com"

// Application URLs
export const APP_URL = process.env.APP_URL ?? "https://vizdiff.io"

export const WORKER_HEALTH_PORT = parseInt(process.env.WORKER_HEALTH_PORT ?? "3003", 10)
