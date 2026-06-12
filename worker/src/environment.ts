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
// Phase 1). Defaults to 4, preserving the historical effective behavior. The previous hardcoded
// pool size was 4: `captureStableScreenshot` holds a process-wide browser mutex, so browser
// navigation/stabilization/screenshot work has always run one story at a time, but the S3 upload,
// baseline download/diff, and result save phases run AFTER the mutex is released, so the pool
// already overlapped those phases with the next story's capture. Lowering this to 1 would make
// those phases fully serial and materially slow ingests for projects with many stories or slow S3.
// Raising it above 4 enables more capture overlap only once the browser mutex is replaced with
// isolated browser contexts/sessions (the Phase 1b isolation step) — see issue #152 for the phased
// plan. Values < 1 are clamped to 1.
export const WORKER_STORY_CONCURRENCY = Math.max(
  1,
  parseInt(process.env.WORKER_STORY_CONCURRENCY ?? "4", 10) || 4,
)
// --- Upload sanity / safety limits -------------------------------------------------------------
// These guard untrusted storybook uploads against zip-bombs, path traversal, pathological story
// counts, and oversized identifiers. All are configurable via env with sane defaults. A value of
// 0 (or a non-positive / non-numeric value) disables the corresponding limit.

function intEnv(name: string, defaultValue: number): number {
  const raw = process.env[name]
  if (raw == undefined || raw.trim() === "") {
    return defaultValue
  }
  const parsed = parseInt(raw, 10)
  if (isNaN(parsed) || parsed < 0) {
    return defaultValue
  }
  return parsed
}

// Maximum number of stories processed from a single upload. Protects the worker and the database
// from a runaway number of screenshots. Default 1000.
export const MAX_STORIES_PER_UPLOAD = intEnv("MAX_STORIES_PER_UPLOAD", 1000)

// Maximum number of files (entries) allowed in an uploaded tarball. Default 50000.
export const MAX_TARBALL_FILES = intEnv("MAX_TARBALL_FILES", 50_000)

// Maximum total uncompressed size of all extracted files (zip-bomb guard). Default 1 GiB.
export const MAX_EXTRACTED_BYTES = intEnv("MAX_EXTRACTED_BYTES", 1024 * 1024 * 1024)

// Maximum size of any single extracted file. Default 256 MiB.
export const MAX_TARBALL_ENTRY_BYTES = intEnv("MAX_TARBALL_ENTRY_BYTES", 256 * 1024 * 1024)

// Maximum length of any single path inside the tarball. Default 4096.
export const MAX_TARBALL_PATH_LENGTH = intEnv("MAX_TARBALL_PATH_LENGTH", 4096)

// Maximum length of a story id / name / title before it is rejected. Default 2048.
export const MAX_STORY_IDENTIFIER_LENGTH = intEnv("MAX_STORY_IDENTIFIER_LENGTH", 2048)
// Maximum wall-clock duration for a single storybook build before it is aborted. A build that
// exceeds this is almost always stuck or pathologically large, so the task is treated as a
// non-retryable failure (see worker.ts). Default: 15 minutes.
export const BUILD_TIMEOUT_MS = parseInt(process.env.BUILD_TIMEOUT_MS ?? `${15 * 60 * 1000}`, 10)

// Resident set size (bytes) past which a build logs a memory-pressure warning. Purely
// observational; it does not abort the build. Default: 2 GiB.
export const BUILD_MEMORY_WARN_BYTES = parseInt(
  process.env.BUILD_MEMORY_WARN_BYTES ?? `${2 * 1024 * 1024 * 1024}`,
  10,
)
