import { Project } from "shared"

import { Database } from "../database"
import { GITLAB_HOST } from "../environment"
import {
  getGitLabClient,
  getGitLabGroupsForUserId,
  listGitLabGroupProjects,
  syncUserGitLabGroups,
} from "../gitlab"
import { log } from "../log"
import { getAccessibleProjectIds } from "../projectAccess"
import type { RequestHandler } from "../types"

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
 * GET /api/gitlab/groups
 * Lists GitLab groups accessible to the current user
 */
export const groups: RequestHandler = async (_req, res) => {
  const { user } = res.locals

  if (!user.gitlabAccessToken) {
    res.status(403).json({ error: "GitLab account not connected" })
    return
  }

  // Ensure groups are up to date
  await syncUserGitLabGroups(user)
  const gitlabGroups = await getGitLabGroupsForUserId(user.id)

  if (gitlabGroups.length === 0) {
    res
      .status(403)
      .json({
        error: "No GitLab groups found. Please ensure you have access to at least one group.",
      })
    return
  }

  // Convert to response format (similar to GitHub orgs format)
  const groupList = gitlabGroups.map((grp) => ({
    id: grp.gitlabGroupId,
    login: grp.fullPath, // Use full_path as login for consistency with GitHub
    name: grp.groupName,
    path: grp.groupPath,
    full_path: grp.fullPath,
    web_url: grp.webUrl,
    avatar_url: grp.avatarUrl,
  }))

  log.debug(
    `Found ${groupList.length} GitLab groups for ${user.gitlabUsername}. ` +
      `Groups: ${groupList.map((g) => g.full_path).join(", ")}`,
  )

  res.json(groupList)
}

/**
 * GET /api/gitlab/projects
 * Lists GitLab projects in a group or all projects accessible to the user
 */
export const projects: RequestHandler = async (req, res) => {
  const { user } = res.locals
  const groupId = req.query.group as string | undefined

  if (!user.gitlabAccessToken) {
    res.status(403).json({ error: "GitLab account not connected" })
    return
  }

  const gitlabHost = user.gitlabHost ?? GITLAB_HOST

  let projectList: GitLabProjectResponse[]

  if (groupId) {
    // Fetch projects for a specific group
    const groupIdNum = parseInt(groupId, 10)
    if (isNaN(groupIdNum)) {
      res.status(400).json({ error: "Invalid group ID" })
      return
    }

    projectList = (await listGitLabGroupProjects(
      groupIdNum,
      user.gitlabAccessToken,
      gitlabHost,
    )) as GitLabProjectResponse[]
  } else {
    // Fetch all projects the user has access to
    const client = getGitLabClient(user.gitlabAccessToken, gitlabHost)
    projectList = (await client.Projects.all({
      membership: true,
      minAccessLevel: 10, // Guest access or higher
      perPage: 100,
    })) as GitLabProjectResponse[]
  }

  // Get the list of project IDs that this user already has VizDiff projects for
  const db = await Database()
  const accessibleProjectIds = await getAccessibleProjectIds(db, user.id)

  // Get a set of GitLab project IDs from the list of accessible project IDs
  const existingGitlabProjectIds = new Set<number>()
  if (accessibleProjectIds.length > 0) {
    const results = await db
      .getRepository(Project)
      .createQueryBuilder("project")
      .select("project.repoId", "repoId")
      .where("project.id IN (:...ids) AND project.vcsProvider = :provider", {
        ids: accessibleProjectIds,
        provider: "gitlab",
      })
      .getRawMany<{ repoId: string }>()

    for (const row of results) {
      existingGitlabProjectIds.add(parseInt(row.repoId, 10))
    }
  }

  // Filter out projects that this user already has a VizDiff project for
  const filteredProjects = projectList.filter((proj) => !existingGitlabProjectIds.has(proj.id))

  log.info(
    {
      user: { id: user.id, gitlabUsername: user.gitlabUsername },
      groupId,
      filteredProjectsLength: filteredProjects.length,
      totalProjectsLength: projectList.length,
    },
    "Returning GitLab projects",
  )

  res.json(filteredProjects)
}
