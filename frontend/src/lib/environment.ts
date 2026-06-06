export const IS_PRODUCTION = process.env.NODE_ENV === "production"

// Runtime configuration injected by the deployment at /config.js (mounted by the Helm
// chart into nginx) as `window.__VIZDIFF_CONFIG__`. This lets a single static frontend
// image be reconfigured per-environment without a rebuild. When absent (local dev, or
// no config.js mounted) we fall back to the build-time NEXT_PUBLIC_* values.
//
// NOTE: the API is reached via same-origin relative `/api/...` paths, so no API base URL
// is needed here. Only APP_URL and GITHUB_ENABLED are environment-specific at runtime.
// Keep the frontend image's build-time NEXT_PUBLIC_* defaults aligned with the Helm values
// for any flag that affects the initially-rendered HTML (e.g. GITHUB_ENABLED) to avoid a
// hydration mismatch; the runtime override is authoritative once hydrated.
interface RuntimeConfig {
  APP_URL?: string
  GITHUB_ENABLED?: boolean
}
const runtimeConfig: RuntimeConfig =
  typeof window === "undefined"
    ? {}
    : ((window as unknown as { ["__VIZDIFF_CONFIG__"]?: RuntimeConfig })["__VIZDIFF_CONFIG__"] ??
      {})

export const APP_URL =
  runtimeConfig.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://vizdiff.io"

// GitHub is disabled by default in self-hosted deployments.
export const GITHUB_ENABLED =
  runtimeConfig.GITHUB_ENABLED ?? process.env.NEXT_PUBLIC_GITHUB_ENABLED === "true"
export const GITHUB_APP_NAME = process.env.NEXT_PUBLIC_GITHUB_APP_NAME
export const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID
