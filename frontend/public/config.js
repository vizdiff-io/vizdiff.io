// Default runtime deployment config (see src/lib/environment.ts). Kubernetes deployments
// mount a generated config.js over this file (Helm configmap-frontend) to inject
// per-environment settings. This fallback ships in the static export so deployments
// without a mounted config (e.g. docker compose) don't have nginx's SPA fallback serve
// index.html in place of this script.
window.__VIZDIFF_CONFIG__ = window.__VIZDIFF_CONFIG__ ?? {}
