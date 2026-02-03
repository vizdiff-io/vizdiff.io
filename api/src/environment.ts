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

export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? ""
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? ""
export const GITHUB_APP_ID = process.env.GITHUB_APP_ID ?? ""
export const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? ""
export const GITHUB_PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY ?? ""

// GitLab OAuth settings
export const GITLAB_HOST = process.env.GITLAB_HOST ?? "https://gitlab.com"
export const GITLAB_CLIENT_ID = process.env.GITLAB_CLIENT_ID ?? ""
export const GITLAB_CLIENT_SECRET = process.env.GITLAB_CLIENT_SECRET ?? ""
export const GITLAB_WEBHOOK_SECRET = process.env.GITLAB_WEBHOOK_SECRET ?? ""
// For self-hosted GitLab with self-signed certificates
export const GITLAB_REJECT_UNAUTHORIZED = process.env.GITLAB_REJECT_UNAUTHORIZED !== "false"

export const APP_URL = process.env.APP_URL ?? "https://vizdiff.io"

export const POSTGRES_USER = process.env.POSTGRES_USER ?? "postgres"
export const POSTGRES_HOST = process.env.POSTGRES_HOST ?? "localhost"
export const POSTGRES_DATABASE = process.env.POSTGRES_DATABASE ?? "vizdiff"
export const POSTGRES_PASS = process.env.POSTGRES_PASS ?? "postgres"
export const POSTGRES_PORT = parseInt(process.env.POSTGRES_PORT ?? "5432")

export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME ?? "vizdiffio-testing"

export const JWT_SECRET = process.env.JWT_SECRET ?? "secret"

export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
export const STRIPE_SCREENSHOT_METER_ID = process.env.STRIPE_SCREENSHOT_METER_ID
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
export const STRIPE_API_VERSION = "2025-04-30.basil"

export const CUSTOMER_IO_API_KEY = process.env.CUSTOMER_IO_API_KEY

export const SES_REGION = process.env.SES_REGION
export const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL

export const SETUP_TOKEN = process.env.SETUP_TOKEN ?? ""

export const TRIAL_PERIOD_MS = 14 * 24 * 60 * 60 * 1000 // 14 days
export const MAX_PROJECTS_PER_USER = 256
export const MAX_TRIAL_SCREENSHOTS = 5000
