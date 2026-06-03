export const IS_PRODUCTION = process.env.NODE_ENV === "production"

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://vizdiff.io"

// GitHub is disabled by default in self-hosted deployments.
export const GITHUB_ENABLED = process.env.NEXT_PUBLIC_GITHUB_ENABLED === "true"
export const GITHUB_APP_NAME = process.env.NEXT_PUBLIC_GITHUB_APP_NAME
export const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID
