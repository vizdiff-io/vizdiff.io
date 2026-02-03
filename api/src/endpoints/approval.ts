import { Gitlab } from "@gitbeaker/rest"
import { createMarkdownForBuildApproval, ScreenshotTest, TestResult } from "shared"

import { trackEvent } from "../customerio"
import { Database } from "../database"
import { APP_URL, ENABLE_VCS_STATUS, GITLAB_HOST } from "../environment"
import { getInstallationForOrg, getOctokitForInstallation } from "../github"
import { getParamInt } from "../http"
import { log } from "../log"
import { getAccessibleProjectIds } from "../projectAccess"
import type { RequestHandler } from "../types"

export const approveOrDeny: RequestHandler = async (req, res) => {
  const { user } = res.locals
  const testId = getParamInt("id", req)
  const status = req.params.status as string | undefined

  if (!testId) {
    res.status(400).json({ error: "Missing id" })
    return
  }
  if (!status) {
    res.status(400).json({ error: "Missing status" })
    return
  }
  if (status !== "approved" && status !== "denied") {
    res.status(400).json({ error: "Invalid status" })
    return
  }

  const db = await Database()

  // Get project IDs the user has access to
  const accessibleProjectIds = await getAccessibleProjectIds(db, user.id)
  if (accessibleProjectIds.length === 0) {
    log.error({ user, testId, status }, "User does not have access to any projects")
    res.status(403).json({ error: "User does not have access to any projects" })
    return
  }

  const testTable = db.getRepository(ScreenshotTest)
  const test = await testTable
    .createQueryBuilder("test")
    .innerJoinAndSelect("test.project", "project")
    .where("test.id = :id", { id: testId })
    .andWhere("project.id IN (:...projectIds)", { projectIds: accessibleProjectIds })
    .getOne()

  if (!test) {
    log.error(
      { user, testId, status, accessibleProjectIds },
      "Test not found in accessible projects",
    )
    res.status(404).json({ error: "Test not found" })
    return
  }

  // Update the screenshot test status
  test.status = status
  await testTable.save(test)

  // Update VCS status if available (GitHub check run or GitLab commit status)
  if (ENABLE_VCS_STATUS && test.vcsStatusId) {
    try {
      // Count the number of visual changes that were approved or denied
      const testResultTable = db.getRepository(TestResult)
      const testResults = await testResultTable.find({
        where: { screenshotTest: { id: test.id } },
      })

      if (test.project.vcsProvider === "github") {
        // Extract the GitHub owner and repo from the repository URL
        const [owner, repo] = test.project.repoUrl.split("/").slice(-2)
        if (!owner || !repo) {
          throw new Error(`Invalid GitHub repository URL: ${test.project.repoUrl}`)
        }

        // Get the installation ID for this project
        const installation = await getInstallationForOrg(user.id, owner)
        if (!installation) {
          throw new Error(`GitHub App installation not found for ${owner}`)
        }

        // Get username (prefer GitHub for GitHub projects, fall back to GitLab)
        const username = user.githubUsername ?? user.gitlabUsername ?? "Unknown"

        const { title, summary, text } = createMarkdownForBuildApproval(test, testResults, username)

        // Create a new check run with the success or failure conclusion
        const conclusion = status === "approved" ? "success" : "failure"
        const octokit = await getOctokitForInstallation(installation.installationId)
        const result = await octokit.checks.create({
          owner,
          repo,
          head_sha: test.commitSha,
          external_id: String(test.id),
          name: "Visual Tests",
          status: "completed",
          conclusion,
          details_url: `${APP_URL}/build?id=${test.id}`,
          output: { title, summary, text },
        })
        log.info(
          {
            userId: user.id,
            testId: test.id,
            checkRunId: result.data.id,
            status,
            createStatus: result.status,
            conclusion,
          },
          `Created GitHub check run ${result.data.id} for ${test.toString()} with conclusion: ${conclusion}`,
        )
      } else {
        // Update GitLab commit status
        const gitlabHost = user.gitlabHost ?? GITLAB_HOST
        const gitlabApi = new Gitlab({
          host: gitlabHost,
          oauthToken: user.gitlabAccessToken!,
        })

        const state = status === "approved" ? "success" : "failed"
        const changeCount = testResults.filter((r) => r.diffRatio && r.diffRatio > 0).length

        await gitlabApi.Commits.editStatus(test.project.repoId, test.commitSha, state, {
          name: "vizdiff/visual-tests",
          targetUrl: `${APP_URL}/build?id=${test.id}`,
          description:
            status === "approved"
              ? `${changeCount} visual change${changeCount === 1 ? "" : "s"} approved`
              : `${changeCount} visual change${changeCount === 1 ? "" : "s"} denied`,
        })

        log.info(
          {
            userId: user.id,
            testId: test.id,
            projectId: test.project.repoId,
            commitSha: test.commitSha,
            status,
            state,
          },
          `Updated GitLab commit status for ${test.toString()} with state: ${state}`,
        )
      }
    } catch (err) {
      log.error({ user, test, status, err }, `Failed to update VCS status for ${test.toString()}`)
      // Don't fail the API call if VCS update fails
    }
  }

  // Track the approval event with Customer.io
  trackEvent(user.id, req, "approval", {
    projectName: test.project.name,
    repo: test.project.githubRepoUrl,
    buildId: test.id,
    status,
  })

  res.json({ success: true })
}
