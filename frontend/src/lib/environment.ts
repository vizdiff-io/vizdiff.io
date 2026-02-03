export const IS_PRODUCTION = process.env.NODE_ENV === "production"

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://vizdiff.io"

export const GITHUB_APP_NAME = process.env.NEXT_PUBLIC_GITHUB_APP_NAME
export const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID

export const GITLAB_APP_NAME = process.env.NEXT_PUBLIC_GITLAB_APP_NAME
export const GITLAB_CLIENT_ID = process.env.NEXT_PUBLIC_GITLAB_CLIENT_ID
export const GITLAB_HOST = process.env.NEXT_PUBLIC_GITLAB_HOST ?? "https://gitlab.com"

export const DD_APPLICATION_ID = process.env.NEXT_PUBLIC_DD_APPLICATION_ID
export const DD_CLIENT_TOKEN = process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID
