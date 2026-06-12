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

// Screenshots live in a private bucket and are embedded in PR/MR comments via presigned URLs.
// Long TTL (S3 SigV4 max of 7 days) because the comments persist after the build completes.
export const VCS_IMAGE_URL_TTL_SECONDS = parseInt(
  process.env.VCS_IMAGE_URL_TTL_SECONDS ?? "604800",
  10,
)

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

// Maximum number of stories rendered concurrently within a single ingest task (issue #152,
// Phase 1). Defaults to 1 (fully sequential), matching the historical effective behavior: even
// though stories were dispatched through a concurrency pool, `captureStableScreenshot` holds a
// process-wide browser mutex, so browser navigation/stabilization/screenshot work has always run
// one story at a time. Raising this only helps once that mutex is replaced with isolated browser
// contexts/sessions (a later Phase 1 step) — see issue #152 for the phased plan. Values < 1 are
// clamped to 1.
export const WORKER_STORY_CONCURRENCY = Math.max(
  1,
  parseInt(process.env.WORKER_STORY_CONCURRENCY ?? "1", 10) || 1,
)
