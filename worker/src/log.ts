import { pino } from "pino"

import { IS_PRODUCTION, IS_TEST } from "./environment"

const level = IS_TEST ? "warn" : IS_PRODUCTION ? "info" : "debug"

export const log = IS_PRODUCTION
  ? pino({
      level,
      formatters: {
        level(label) {
          return { status: label }
        },
      },
    })
  : pino({
      level,
      transport: {
        target: "pino-pretty",
        options: { colorize: !IS_TEST },
      },
    })
