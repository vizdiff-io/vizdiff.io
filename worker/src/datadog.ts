import dd from "dd-trace"

import { log } from "./log"

// Only initialize Datadog in production or staging environments
if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging") {
  const env = process.env.NODE_ENV
  log.info(`Initializing Datadog tracer in "${env}" environment`)
  dd.init({
    logInjection: true,
    profiling: true,
    service: "vizdiff-worker",
    env,
  })
}
