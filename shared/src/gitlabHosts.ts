/**
 * Per-host GitLab service token configuration.
 *
 * In a self-hosted deployment, VizDiff no longer relies on each user's OAuth token to
 * call the GitLab API. Instead, the operator configures a service token (PAT or group/project
 * access token with `api` scope and Developer+ role) per GitLab host. The API and worker resolve
 * the correct token for a given host when posting commit statuses or reading projects.
 */
export interface GitLabHostConfig {
  /** The GitLab origin, e.g. `https://gitlab.com` or `https://gitlab.corp.example.com`. */
  host: string
  /** Service token with `api` scope used for all API calls against this host. */
  token: string
  /**
   * Whether TLS certificates must be valid. Set to `false` for on-prem GitLab instances using
   * self-signed certificates. Defaults to `true`.
   */
  rejectUnauthorized: boolean
  /** Optional per-host webhook secret used to verify incoming GitLab webhooks. */
  webhookSecret?: string
}

/** Normalize a host string to a comparable origin (scheme + host + port, no trailing slash). */
function toOrigin(host: string): string {
  try {
    return new URL(host).origin
  } catch {
    // Not a full URL; strip any trailing slash and return as-is for best-effort matching.
    return host.replace(/\/+$/, "")
  }
}

/**
 * Parse the GitLab host configuration from environment variables.
 *
 * Primary form (multi-host): `GITLAB_HOSTS` is a JSON array of {@link GitLabHostConfig} objects, e.g.
 *   GITLAB_HOSTS='[{"host":"https://gitlab.com","token":"glpat-…","rejectUnauthorized":true},
 *                  {"host":"https://gitlab.corp.example.com","token":"glpat-…","rejectUnauthorized":false}]'
 *
 * Fallback form (single-host): when `GITLAB_HOSTS` is unset, a single host is derived from
 * `GITLAB_HOST` + `GITLAB_TOKEN` (+ optional `GITLAB_REJECT_UNAUTHORIZED` and `GITLAB_WEBHOOK_SECRET`).
 */
export function parseGitLabHosts(env: NodeJS.ProcessEnv = process.env): GitLabHostConfig[] {
  const raw = env.GITLAB_HOSTS?.trim()
  if (raw) {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      throw new Error(
        `Failed to parse GITLAB_HOSTS as JSON: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    if (!Array.isArray(parsed)) {
      throw new Error("GITLAB_HOSTS must be a JSON array of host configuration objects")
    }
    return parsed.map((entry, index) => {
      if (typeof entry !== "object" || entry === null) {
        throw new Error(`GITLAB_HOSTS[${index}] must be an object`)
      }
      const obj = entry as Record<string, unknown>
      if (typeof obj.host !== "string" || obj.host.length === 0) {
        throw new Error(`GITLAB_HOSTS[${index}].host must be a non-empty string`)
      }
      if (typeof obj.token !== "string" || obj.token.length === 0) {
        throw new Error(`GITLAB_HOSTS[${index}].token must be a non-empty string`)
      }
      const rejectUnauthorized = obj.rejectUnauthorized !== false // default true
      const webhookSecret =
        typeof obj.webhookSecret === "string" && obj.webhookSecret.length > 0
          ? obj.webhookSecret
          : undefined
      return {
        host: toOrigin(obj.host),
        token: obj.token,
        rejectUnauthorized,
        webhookSecret,
      }
    })
  }

  // Single-host fallback
  const host = env.GITLAB_HOST?.trim()
  const token = env.GITLAB_TOKEN?.trim()
  if (host && token) {
    return [
      {
        host: toOrigin(host),
        token,
        rejectUnauthorized: env.GITLAB_REJECT_UNAUTHORIZED !== "false",
        webhookSecret:
          env.GITLAB_WEBHOOK_SECRET && env.GITLAB_WEBHOOK_SECRET.length > 0
            ? env.GITLAB_WEBHOOK_SECRET
            : undefined,
      },
    ]
  }

  return []
}

/**
 * Resolve the configuration for a given GitLab host using exact-origin matching. The lookup is
 * scheme/host/port sensitive so that e.g. `https://gitlab.com` never resolves a token configured
 * for an on-prem instance.
 */
export function resolveGitLabHost(
  hosts: GitLabHostConfig[],
  host: string,
): GitLabHostConfig | undefined {
  const wanted = toOrigin(host)
  return hosts.find((cfg) => cfg.host === wanted)
}
