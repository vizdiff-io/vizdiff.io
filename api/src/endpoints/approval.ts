import { ScreenshotTest } from "shared"

import { Database } from "../database"
import { getInstallationForOrg, updateGitHubCheckRun } from "../github"
import type { GitHubCheckConclusion } from "../github"
import { getParamInt } from "../http"
import { log } from "../log"
import type { RequestHandler } from "../types"

export const approveOrDeny: RequestHandler = async (req, res) => {
  const { user } = res.locals
  const id = getParamInt("id", req)
  const status = req.params.status as string | undefined

  if (!id) {
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
  const testTable = db.getRepository(ScreenshotTest)
  const test = await testTable
    .createQueryBuilder("test")
    .innerJoinAndSelect("test.project", "project")
    .where("test.id = :id AND project.user = :userId", { id, userId: user.id })
    .getOne()

  if (!test) {
    res.status(404).json({ error: "Test not found" })
    return
  }

  // Update the screenshot test status
  test.status = status
  await testTable.save(test)

  // Update GitHub check run if available
  if (test.githubCheckRunId) {
    try {
      // Extract the GitHub owner and repo from the GitHub repository URL
      const [owner, repo] = test.project.githubRepoUrl.split("/").slice(-2)
      if (!owner || !repo) {
        log.error(`Invalid GitHub repository URL: ${test.project.githubRepoUrl}`)
      } else {
        // Get the installation ID for this project
        const installation = await getInstallationForOrg(user.id, owner)
        if (installation) {
          const conclusion: GitHubCheckConclusion = status === "approved" ? "success" : "failure"
          const summary =
            status === "approved"
              ? `Visual tests approved by ${user.githubUsername}`
              : `Visual tests denied by ${user.githubUsername}`

          await updateGitHubCheckRun(
            {
              owner,
              repo,
              checkRunId: test.githubCheckRunId,
              installationId: installation.installationId,
            },
            "completed",
            conclusion,
            test.id,
            summary,
          )

          log.info(
            `Updated GitHub check run ${test.githubCheckRunId} for ${test.toString()} with conclusion: ${conclusion}`,
          )
        } else {
          log.error(`GitHub App installation not found for ${owner}`)
        }
      }
    } catch (err) {
      const error = err
      log.error(error, `Failed to update GitHub check run for ${test.toString()}`)
      // Don't fail the API call if GitHub update fails
    }
  }

  res.json({ success: true })
}
