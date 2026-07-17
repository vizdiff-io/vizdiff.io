import { pino } from "pino"

import { IS_PRODUCTION, IS_TEST } from "./environment"

const level = IS_TEST ? "warn" : IS_PRODUCTION ? "info" : "debug"

// Defense in depth: censor secret-bearing fields (OAuth tokens, credentials, auth headers) that
// might slip into structured log objects.
const redact = [
  "githubAccessToken",
  "*.githubAccessToken",
  "*.*.githubAccessToken",
  "accessToken",
  "*.accessToken",
  "token",
  "*.token",
  "password",
  "*.password",
  "secret",
  "*.secret",
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers.jwt",
]

export const log = IS_PRODUCTION
  ? pino({
      level,
      redact,
      formatters: {
        level(label) {
          return { status: label }
        },
      },
    })
  : pino({
      level,
      redact,
      transport: {
        target: "pino-pretty",
        options: { colorize: !IS_TEST },
      },
    })
