import { config as configEnv } from "dotenv-flow"
import * as path from "path"
import { fileURLToPath } from "url"

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const envPath = path.join(dirname, "..")

// Load the `api/.env*` file into process.env
configEnv({ path: envPath, node_env: process.env.NODE_ENV ?? "development" })

export const IS_PRODUCTION = process.env.NODE_ENV === "production"
export const IS_TEST = process.env.NODE_ENV === "test"

export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? ""
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? ""

export const POSTGRES_USER = process.env.POSTGRES_USER ?? "postgres"
export const POSTGRES_HOST = process.env.POSTGRES_HOST ?? "127.0.0.1"
export const POSTGRES_DATABASE = process.env.POSTGRES_DATABASE ?? "vizdiff"
export const POSTGRES_PASS = process.env.POSTGRES_PASS ?? "postgres"
export const POSTGRES_PORT = parseInt(process.env.POSTGRES_PORT ?? "5432")

export const JWT_SECRET = process.env.JWT_SECRET ?? "secret"
