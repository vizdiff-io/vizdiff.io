import { createAppAuth } from "@octokit/auth-app"
import { Octokit } from "@octokit/rest"

import {
  GITHUB_APP_ID,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_PRIVATE_KEY,
  APP_URL,
} from "./environment"
import { log } from "./log"

export interface GitHubCheckData {
  owner: string
  repo: string
  checkRunId: number
  installationId: number
}

// <https://docs.github.com/en/rest/checks/runs?apiVersion=2022-11-28#update-a-check-run>
export type GitHubCheckStatus = "queued" | "completed" | "in_progress"

// <https://docs.github.com/en/rest/checks/runs?apiVersion=2022-11-28#update-a-check-run>
export type GitHubCheckConclusion =
  | "action_required"
  | "cancelled"
  | "failure"
  | "neutral"
  | "skipped"
  | "stale"
  | "success"
  | "timed_out"

/**
 * Get an authenticated Octokit instance for a specific installation
 */
export async function getOctokitForInstallation(installationId: number): Promise<Octokit> {
  const auth = createAppAuth({
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_PRIVATE_KEY,
    clientId: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
  })

  const installationAuth = await auth({ type: "installation", installationId })
  return new Octokit({ auth: installationAuth.token })
}

/**
 * Update a GitHub check run with the results of a screenshot test
 */
export async function updateGitHubCheckRun({
  owner,
  repo,
  installationId,
  checkRunId,
  status,
  conclusion,
  testId,
  title,
  summary,
  text,
}: GitHubCheckData & {
  status: GitHubCheckStatus
  conclusion?: GitHubCheckConclusion
  testId: number
  title: string
  summary: string
  text?: string
}): Promise<void> {
  try {
    log.info(
      `Updating GitHub check run ${checkRunId} with status: ${status}, conclusion: ${conclusion}`,
    )

    const octokit = await getOctokitForInstallation(installationId)

    await octokit.checks.update({
      owner,
      repo,
      check_run_id: checkRunId,
      status,
      conclusion: status === "completed" ? conclusion : undefined,
      details_url: `${APP_URL}/build?id=${testId}`,
      output: { title, summary, text },
    })

    log.info(
      `Successfully updated GitHub check run ${checkRunId} with status: ${status}, conclusion: ${conclusion}`,
    )
  } catch (error) {
    log.error(error, "Failed to update GitHub check run")
    throw error
  }
}
