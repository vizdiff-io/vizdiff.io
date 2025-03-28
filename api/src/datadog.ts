import * as dd from "dd-trace"

// Skip Datadog initialization in test environment
if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
  dd.init({
    logInjection: true,
    profiling: true,
    env: process.env.NODE_ENV ?? "development",
    clientIpEnabled: true,
  })
}

export const tracer = dd.tracer
