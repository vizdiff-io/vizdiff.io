import { Gitlab } from "@gitbeaker/rest"
import https from "node:https"

import { GITLAB_HOST, GITLAB_REJECT_UNAUTHORIZED, APP_URL, ENABLE_VCS_STATUS } from "./environment"
import { log } from "./log"

/**
 * Data stored in WorkTask for GitLab commit status updates.
 * Token is resolved from the project owner at processing time - never stored in the task.
 */
export interface GitLabCheckData {
  projectId: number
  commitSha: string
  gitlabHost: string
}

// GitLab commit status states
export type GitLabStatusState = "pending" | "running" | "success" | "failed" | "canceled"

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
    agent: GITLAB_REJECT_UNAUTHORIZED ? undefined : new https.Agent({ rejectUnauthorized: false }),
  })
}

/**
 * Update a GitLab commit status with the results of a screenshot test
 */
export async function updateGitLabCommitStatus({
  projectId,
  commitSha,
  gitlabHost,
  accessToken,
  state,
  testId,
  name,
  description,
}: GitLabCheckData & {
  accessToken: string
  state: GitLabStatusState
  testId: number
  name: string
  description: string
}): Promise<void> {
  if (!ENABLE_VCS_STATUS) {
    log.info(`Skipping GitLab commit status update (ENABLE_VCS_STATUS not set)`)
    return
  }

  if (!accessToken) {
    log.warn(`No GitLab access token provided, skipping commit status update`)
    return
  }

  try {
    log.info(
      `Updating GitLab commit status for project ${projectId}, commit ${commitSha}: state=${state}`,
    )

    const client = getGitLabClient(accessToken, gitlabHost)

    await client.Commits.editStatus(projectId, commitSha, state, {
      name,
      targetUrl: `${APP_URL}/build?id=${testId}`,
      description,
    })

    log.info(
      `Successfully updated GitLab commit status for project ${projectId}, commit ${commitSha}: state=${state}`,
    )
  } catch (error) {
    log.error(error, "Failed to update GitLab commit status")
    // Don't throw - GitLab status update failures shouldn't block the build
  }
}
