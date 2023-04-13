import { pino } from "pino"

import { IS_PRODUCTION, IS_TEST } from "./environment"

export const log = IS_PRODUCTION
  ? pino()
  : pino({
      level: "debug",
      transport: {
        target: "pino-pretty",
        options: { colorize: !IS_TEST },
      },
    })
