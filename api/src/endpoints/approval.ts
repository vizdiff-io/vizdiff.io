import { createMarkdownForBuildApproval, ScreenshotTest, TestResult } from "shared"

import { Database } from "../database"
import { APP_URL } from "../environment"
import { getInstallationForOrg, getOctokitForInstallation } from "../github"
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
      // Count the number of visual changes that were approved or denied
      const testResultTable = db.getRepository(TestResult)
      const testResults = await testResultTable.find({
        where: { screenshotTest: { id: test.id } },
      })

      // Extract the GitHub owner and repo from the GitHub repository URL
      const [owner, repo] = test.project.githubRepoUrl.split("/").slice(-2)
      if (!owner || !repo) {
        throw new Error(`Invalid GitHub repository URL: ${test.project.githubRepoUrl}`)
      }

      // Get the installation ID for this project
      const installation = await getInstallationForOrg(user.id, owner)
      if (!installation) {
        throw new Error(`GitHub App installation not found for ${owner}`)
      }

      const approved = status === "approved"
      const conclusion = approved ? "success" : "failure"
      const { title, summary, text } = createMarkdownForBuildApproval(
        test,
        testResults,
        approved,
        user.githubUsername,
      )

      // Create a new check run with the success or failure conclusion
      const octokit = await getOctokitForInstallation(installation.installationId)
      const result = await octokit.checks.create({
        owner,
        repo,
        head_sha: test.commitSha,
        name: "Visual Tests Approval",
        status: "completed",
        conclusion,
        details_url: `${APP_URL}/build?id=${test.id}`,
        output: { title, summary, text },
      })
      log.info(
        `Created GitHub check run ${result.data.id} for ${test.toString()} with conclusion: ${conclusion}`,
      )
    } catch (err) {
      const error = err
      log.error(error, `Failed to update GitHub check run for ${test.toString()}`)
      // Don't fail the API call if GitHub update fails
    }
  }

  res.json({ success: true })
}
