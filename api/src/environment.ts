import * as path from "path"
import { config as configEnv } from "dotenv-flow"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.join(__dirname, "..")

// Load the `api/.env` file into process.env
configEnv({ path: envPath })

export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? ""
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? ""

export const POSTGRES_USER = process.env.POSTGRES_USER ?? "postgres"
export const POSTGRES_HOST = process.env.POSTGRES_HOST ?? "127.0.0.1"
export const POSTGRES_DATABASE = process.env.POSTGRES_DATABASE ?? "vizdiff"
export const POSTGRES_PASS = process.env.POSTGRES_PASS ?? "postgres"
export const POSTGRES_PORT = parseInt(process.env.POSTGRES_PORT ?? "5432")

export const JWT_SECRET = process.env.JWT_SECRET ?? "secret"
