import { Gitlab } from "@gitbeaker/rest"
import https from "node:https"
import { type GitLabHostConfig, parseGitLabHosts, resolveGitLabHost } from "shared"
import { Agent, fetch } from "undici"

import { GITLAB_HOST } from "./environment"
import { log } from "./log"

/**
 * Parsed GitLab host configuration (service tokens, TLS, webhook secrets). Parsed once from the
 * environment and cached for the process lifetime.
 */
let cachedHosts: GitLabHostConfig[] | undefined
export function getGitLabHosts(): GitLabHostConfig[] {
  cachedHosts ??= parseGitLabHosts(process.env)
  return cachedHosts
}

/** Resolve the configured service-token config for a host, or undefined if not configured. */
export function getGitLabHostConfig(host: string): GitLabHostConfig | undefined {
  return resolveGitLabHost(getGitLabHosts(), host)
}

/** Resolve the configured service-token config for a host, throwing if it is not configured. */
function requireHostConfig(host: string): GitLabHostConfig {
  const cfg = getGitLabHostConfig(host)
  if (!cfg) {
    throw new Error(
      `No GitLab service token configured for host "${host}". ` +
        `Set GITLAB_HOSTS (or GITLAB_HOST + GITLAB_TOKEN) for this instance.`,
    )
  }
  return cfg
}

// Cache per-host undici Agents so on-prem self-signed instances work while gitlab.com stays strict.
const agentCache = new Map<string, Agent>()
function agentFor(cfg: GitLabHostConfig): Agent {
  let agent = agentCache.get(cfg.host)
  if (!agent) {
    agent = new Agent({ connect: { rejectUnauthorized: cfg.rejectUnauthorized } })
    agentCache.set(cfg.host, agent)
  }
  return agent
}

/**
 * fetch wrapper for raw GitLab API calls against a specific host, honoring that host's
 * `rejectUnauthorized` setting (required for self-hosted GitLab with self-signed certificates).
 */
export function gitlabFetchFor(
  cfg: GitLabHostConfig,
  url: string | URL,
  init?: Parameters<typeof fetch>[1],
): ReturnType<typeof fetch> {
  return fetch(url, {
    ...init,
    dispatcher: agentFor(cfg),
  } as Parameters<typeof fetch>[1])
}

/**
 * GitLab project from API
 */
export interface GitLabProjectResponse {
  id: number
  name: string
  path: string
  path_with_namespace: string
  web_url: string
  namespace: {
    id: number
    name: string
    path: string
    kind: string
    full_path: string
  }
}

/**
 * Data stored in WorkTask for GitLab commit status updates.
 * The service token is resolved from the configured host at processing time - never stored.
 */
export interface GitLabCheckData {
  projectId: number
  commitSha: string
  gitlabHost: string
}

/**
 * Get an authenticated GitLab API client for the given host using the configured service token.
 */
export function getGitLabClient(host: string = GITLAB_HOST): InstanceType<typeof Gitlab> {
  const cfg = requireHostConfig(host)
  return new Gitlab({
    host: cfg.host,
    token: cfg.token,
    agent: cfg.rejectUnauthorized ? undefined : new https.Agent({ rejectUnauthorized: false }),
  })
}

/**
 * List projects accessible to the service token on the given host (used for the project-create UI).
 */
export async function listGitLabProjects(
  host: string = GITLAB_HOST,
): Promise<GitLabProjectResponse[]> {
  const client = getGitLabClient(host)
  return (await client.Projects.all({
    membership: true,
    perPage: 100,
  })) as GitLabProjectResponse[]
}

/**
 * List projects in a GitLab group using the configured service token.
 */
export async function listGitLabGroupProjects(
  groupId: number,
  host: string = GITLAB_HOST,
): Promise<GitLabProjectResponse[]> {
  const client = getGitLabClient(host)
  const projects = (await client.Groups.allProjects(groupId, {
    perPage: 100,
    includeSubgroups: true,
  })) as GitLabProjectResponse[]
  return projects
}

/**
 * Create or update a commit status on GitLab using the configured per-host service token.
 */
export async function updateGitLabCommitStatus(
  projectId: number,
  commitSha: string,
  state: "pending" | "running" | "success" | "failed" | "canceled",
  options: {
    name: string
    targetUrl: string
    description: string
    host?: string
  },
): Promise<void> {
  const client = getGitLabClient(options.host ?? GITLAB_HOST)

  try {
    await client.Commits.editStatus(projectId, commitSha, state, {
      name: options.name,
      targetUrl: options.targetUrl,
      description: options.description,
    })

    log.debug(
      `Updated GitLab commit status for project ${projectId}, commit ${commitSha}: ${state}`,
    )
  } catch (error) {
    log.error(
      error,
      `Failed to update GitLab commit status for project ${projectId}, commit ${commitSha}`,
    )
    throw error
  }
}
