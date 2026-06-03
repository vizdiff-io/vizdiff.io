import { Project } from "shared"

import { Database } from "../database"
import { GITLAB_HOST } from "../environment"
import { getGitLabClient, getGitLabHosts, listGitLabGroupProjects } from "../gitlab"
import { log } from "../log"
import type { RequestHandler } from "../types"

/**
 * GitLab group response type
 */
interface GitLabGroupResponse {
  id: number
  name: string
  path: string
  full_path: string
  web_url: string
  avatar_url: string | null
}

/**
 * GitLab project response type
 */
interface GitLabProjectResponse {
  id: number
  name: string
  path: string
  path_with_namespace: string
  web_url: string
  visibility: string
  namespace: {
    id: number
    name: string
    path: string
    kind: string
    full_path: string
  }
}

/**
 * Resolve the GitLab host to operate against. Accepts an optional `?host=` query param, validated
 * against the configured hosts; otherwise falls back to the default host.
 */
function resolveRequestHost(host: string | undefined): string {
  if (host) {
    const known = getGitLabHosts().some((cfg) => cfg.host === host)
    if (known) {
      return host
    }
  }
  return GITLAB_HOST
}

/**
 * GET /api/gitlab/groups
 * Lists GitLab groups visible to the configured service token (used for the create-project UI).
 */
export const groups: RequestHandler = async (req, res) => {
  const host = resolveRequestHost(req.query.host as string | undefined)

  const client = getGitLabClient(host)
  const gitlabGroups = (await client.Groups.all({ perPage: 100 })) as GitLabGroupResponse[]

  const groupList = gitlabGroups.map((grp) => ({
    id: grp.id,
    login: grp.full_path, // Use full_path as login for consistency with GitHub
    name: grp.name,
    path: grp.path,
    full_path: grp.full_path,
    web_url: grp.web_url,
    avatar_url: grp.avatar_url,
  }))

  log.debug(`Found ${groupList.length} GitLab groups on ${host}`)
  res.json(groupList)
}

/**
 * GET /api/gitlab/projects
 * Lists GitLab projects in a group (or all visible to the service token) for project creation.
 */
export const projects: RequestHandler = async (req, res) => {
  const groupId = req.query.group as string | undefined
  const host = resolveRequestHost(req.query.host as string | undefined)

  let projectList: GitLabProjectResponse[]

  if (groupId) {
    const groupIdNum = parseInt(groupId, 10)
    if (isNaN(groupIdNum)) {
      res.status(400).json({ error: "Invalid group ID" })
      return
    }
    projectList = (await listGitLabGroupProjects(groupIdNum, host)) as GitLabProjectResponse[]
  } else {
    const client = getGitLabClient(host)
    projectList = (await client.Projects.all({
      membership: true,
      perPage: 100,
    })) as GitLabProjectResponse[]
  }

  // Filter out projects that already have a VizDiff project for this host.
  const db = await Database()
  const existing = await db
    .getRepository(Project)
    .createQueryBuilder("project")
    .select("project.repoId", "repoId")
    .where("project.vcsProvider = :provider AND project.gitlabHost = :host", {
      provider: "gitlab",
      host,
    })
    .getRawMany<{ repoId: string }>()

  const existingGitlabProjectIds = new Set<number>(existing.map((row) => parseInt(row.repoId, 10)))
  const filteredProjects = projectList.filter((proj) => !existingGitlabProjectIds.has(proj.id))

  log.info(
    {
      host,
      groupId,
      filteredProjectsLength: filteredProjects.length,
      totalProjectsLength: projectList.length,
    },
    "Returning GitLab projects",
  )

  res.json(filteredProjects)
}
