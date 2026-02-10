import { Gitlab } from "@gitbeaker/rest"
import { GitLabGroup, User, UserGitlabProjectAccess } from "shared"

import { Database } from "./database"
import { GITLAB_HOST, GITLAB_REJECT_UNAUTHORIZED } from "./environment"
import { log } from "./log"

/**
 * GitLab group from API
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
 * GitLab project from API
 */
interface GitLabProjectResponse {
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

export interface GitLabCheckData {
  projectId: number
  commitSha: string
  gitlabHost: string
  accessToken: string
}

/**
 * Get an authenticated GitLab API client
 */
export function getGitLabClient(
  oauthToken: string,
  host: string = GITLAB_HOST,
): InstanceType<typeof Gitlab> {
  return new Gitlab({
    host,
    oauthToken,
    rejectUnauthorized: GITLAB_REJECT_UNAUTHORIZED,
  })
}

/**
 * Sync GitLab groups for a user
 */
export async function syncUserGitLabGroups(user: User): Promise<GitLabGroup[]> {
  if (!user.gitlabAccessToken) {
    log.debug(`User ${user.id} has no GitLab access token, skipping group sync`)
    return []
  }

  const db = await Database()
  const gitlabHost = user.gitlabHost ?? GITLAB_HOST
  const client = getGitLabClient(user.gitlabAccessToken, gitlabHost)

  try {
    // Fetch all groups the user has access to
    const groups = (await client.Groups.all({
      minAccessLevel: 10, // Guest access or higher
      perPage: 100,
    })) as GitLabGroupResponse[]

    log.debug(`Found ${groups.length} GitLab groups for user ${user.id}`)

    const results: GitLabGroup[] = []

    for (const group of groups) {
      // Create or update the group record
      let gitlabGroup = await db.manager.findOneBy(GitLabGroup, {
        gitlabGroupId: group.id,
        gitlabHost,
      })

      if (!gitlabGroup) {
        // Create new group
        gitlabGroup = new GitLabGroup()
        gitlabGroup.gitlabGroupId = group.id
        gitlabGroup.gitlabHost = gitlabHost
      }

      // Update group info
      gitlabGroup.groupPath = group.path
      gitlabGroup.groupName = group.name
      gitlabGroup.fullPath = group.full_path
      gitlabGroup.webUrl = group.web_url
      gitlabGroup.avatarUrl = group.avatar_url

      gitlabGroup = await db.manager.save(GitLabGroup, gitlabGroup)

      // Link to user if not already linked
      const userGroup = await db.manager
        .createQueryBuilder()
        .select("ug.user_id", "userId")
        .from("user_gitlab_groups", "ug")
        .where("ug.user_id = :userId AND ug.group_id = :groupId", {
          userId: user.id,
          groupId: gitlabGroup.id,
        })
        .getRawOne<{ userId: number }>()

      if (!userGroup) {
        await db.manager
          .createQueryBuilder()
          .insert()
          .into("user_gitlab_groups")
          .values({
            user_id: user.id,
            group_id: gitlabGroup.id,
          })
          .execute()
      }

      results.push(gitlabGroup)
    }

    log.info(
      `GitLab group sync for user ${user.gitlabUsername} (${user.id}) ` +
        `found ${results.length} groups`,
    )

    return results
  } catch (error) {
    log.error(error, `Failed to sync GitLab groups for user ${user.id}`)
    throw error
  }
}

/**
 * Get GitLab groups accessible to a user
 */
export async function getGitLabGroupsForUserId(userId: number): Promise<GitLabGroup[]> {
  const db = await Database()
  return await db.manager
    .createQueryBuilder(GitLabGroup, "grp")
    .innerJoin("user_gitlab_groups", "ug", "ug.group_id = grp.id")
    .where("ug.user_id = :userId", { userId })
    .getMany()
}

/**
 * Sync GitLab projects for a user
 */
export async function syncUserGitLabProjects(user: User): Promise<number> {
  if (!user.gitlabAccessToken) {
    log.debug(`User ${user.id} has no GitLab access token, skipping project sync`)
    return 0
  }

  const db = await Database()
  const gitlabHost = user.gitlabHost ?? GITLAB_HOST
  const client = getGitLabClient(user.gitlabAccessToken, gitlabHost)

  try {
    log.debug({ userId: user.id }, "Starting GitLab project sync")

    // Fetch all projects the user has access to
    const projects = (await client.Projects.all({
      membership: true, // Only projects the user is a member of
      minAccessLevel: 10, // Guest access or higher
      perPage: 100,
    })) as GitLabProjectResponse[]

    log.debug(`Found ${projects.length} GitLab projects for user ${user.id}`)

    const accessibleProjectIds = new Set<number>()
    for (const project of projects) {
      accessibleProjectIds.add(project.id)
    }

    // Atomically update UserGitlabProjectAccess table
    await db.manager.transaction(async (transactionalEntityManager) => {
      // Delete old records for this user and host.
      // Also delete any records that would conflict (same userId + gitlabProjectId but different gitlabHost).
      // This handles the case where gitlabHost might not be part of the primary key constraint in the database,
      // which would cause primary key violations when inserting new records with overlapping project IDs.
      if (accessibleProjectIds.size > 0) {
        // Delete records matching the current host
        await transactionalEntityManager
          .createQueryBuilder()
          .delete()
          .from(UserGitlabProjectAccess)
          .where("user_id = :userId AND gitlab_host = :gitlabHost", {
            userId: user.id,
            gitlabHost,
          })
          .execute()

        // Also delete any conflicting records (same userId + projectId but different host)
        // This prevents primary key violations if gitlabHost is not part of the primary key
        await transactionalEntityManager
          .createQueryBuilder()
          .delete()
          .from(UserGitlabProjectAccess)
          .where(
            "user_id = :userId AND gitlab_project_id IN (:...projectIds) AND gitlab_host != :gitlabHost",
            {
              userId: user.id,
              projectIds: Array.from(accessibleProjectIds),
              gitlabHost,
            },
          )
          .execute()
      } else {
        // No projects found, just delete all records for this user and host
        await transactionalEntityManager
          .createQueryBuilder()
          .delete()
          .from(UserGitlabProjectAccess)
          .where("user_id = :userId AND gitlab_host = :gitlabHost", {
            userId: user.id,
            gitlabHost,
          })
          .execute()
      }

      // Insert new records if any projects were found
      if (accessibleProjectIds.size > 0) {
        const newAccessRecords = Array.from(accessibleProjectIds).map((projectId) => ({
          userId: user.id,
          gitlabProjectId: projectId,
          gitlabHost,
        }))

        await transactionalEntityManager.save(UserGitlabProjectAccess, newAccessRecords, {
          chunk: 200,
        })
      }
    })

    log.info(
      { userId: user.id, projectCount: accessibleProjectIds.size },
      "Successfully completed GitLab project sync",
    )

    return accessibleProjectIds.size
  } catch (error) {
    log.error({ user, error }, "GitLab project sync failed")
    throw error
  }
}

/**
 * List projects in a GitLab group
 */
export async function listGitLabGroupProjects(
  groupId: number,
  accessToken: string,
  host: string = GITLAB_HOST,
): Promise<GitLabProjectResponse[]> {
  const client = getGitLabClient(accessToken, host)
  const projects = (await client.Groups.allProjects(groupId, {
    perPage: 100,
    includeSubgroups: true,
  })) as GitLabProjectResponse[]
  return projects
}

/**
 * Create or update a commit status on GitLab
 */
export async function updateGitLabCommitStatus(
  projectId: number,
  commitSha: string,
  state: "pending" | "running" | "success" | "failed" | "canceled",
  options: {
    name: string
    targetUrl: string
    description: string
    accessToken: string
    host?: string
  },
): Promise<void> {
  const client = getGitLabClient(options.accessToken, options.host ?? GITLAB_HOST)

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
