import dd from "dd-trace"

const IS_PRODUCTION = process.env.NODE_ENV === "production"
const IS_STAGING = process.env.NODE_ENV === "staging"

// Only initialize Datadog in production or staging environments
if (IS_PRODUCTION || IS_STAGING) {
  const service = "vizdiff-api"
  const env = process.env.NODE_ENV
  console.log(`Initializing ${service} Datadog tracer in "${env}" environment`)
  dd.init({
    logInjection: true,
    profiling: true,
    service,
    env,
    clientIpEnabled: true,
  })
}

export function setUser(user: dd.User): void {
  if (IS_PRODUCTION || IS_STAGING) {
    dd.tracer.setUser(user)
  }
}
