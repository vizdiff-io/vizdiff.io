import * as dd from "dd-trace"

dd.init({
  logInjection: true,
  profiling: true,
  env: process.env.NODE_ENV ?? "development",
})

export const tracer = dd.tracer
