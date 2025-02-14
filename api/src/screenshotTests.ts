import { Project, ScreenshotTest } from "shared"

import { Database } from "./database"

export async function createScreenshotTest(
  project: Project,
  commitSha: string,
  branch: string,
  uploadId: string,
  baseCommitSha?: string,
  baseBranch?: string,
): Promise<ScreenshotTest> {
  if (!commitSha || !branch || !uploadId) {
    throw new Error("Missing required parameters")
  }

  // Start a transaction to retrieve the previous highest build number and
  // create the new screenshot test
  const db = await Database()
  const createdScreenshotTest = await db.transaction(async (manager) => {
    // Get the max build number for this project
    const result = (await manager
      .createQueryBuilder()
      .select("COALESCE(MAX(build_number), 0)", "maxBuildNumber")
      .from(ScreenshotTest, "st")
      .where("project_id = :projectId", { projectId: project.id })
      .getRawOne()) as unknown as { maxBuildNumber: number } | undefined
    const buildNumber = (result?.maxBuildNumber ?? 0) + 1

    // Create the new screenshot test
    const screenshotTest = new ScreenshotTest()
    screenshotTest.projectId = project.id
    screenshotTest.buildNumber = buildNumber
    screenshotTest.commitSha = commitSha
    screenshotTest.branch = branch
    screenshotTest.baseCommitSha = baseCommitSha
    screenshotTest.baseBranch = baseBranch
    screenshotTest.uploadId = uploadId
    screenshotTest.status = "pending"

    return await manager.save(screenshotTest)
  })

  return createdScreenshotTest
}
