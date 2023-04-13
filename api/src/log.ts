import { pino } from "pino"

const IS_PRODUCTION = process.env.NODE_ENV === "production"

export const log = IS_PRODUCTION
  ? pino()
  : pino({
      level: "debug",
      transport: {
        target: "pino-pretty",
        options: { colorize: true },
      },
    })
