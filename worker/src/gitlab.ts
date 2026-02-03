import { Gitlab } from "@gitbeaker/rest"

import {
  GITLAB_HOST,
  GITLAB_REJECT_UNAUTHORIZED,
  APP_URL,
  IS_PRODUCTION,
  IS_STAGING,
} from "./environment"
import { log } from "./log"

export interface GitLabCheckData {
  projectId: number
  commitSha: string
  gitlabHost: string
  accessToken: string
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
    rejectUnauthorized: GITLAB_REJECT_UNAUTHORIZED,
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
  state: GitLabStatusState
  testId: number
  name: string
  description: string
}): Promise<void> {
  if (!IS_PRODUCTION && !IS_STAGING) {
    log.info(`Skipping GitLab commit status update in development environment`)
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
