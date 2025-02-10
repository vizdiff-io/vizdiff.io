import { ScreenshotTest } from "shared"
import { getParamInt } from "src/http"

import { Database } from "../database"
import type { DefaultRequest, DefaultResponse } from "../types"

export async function get(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const id = getParamInt("id", req)
  if (!id) {
    throw new Error("Missing id")
  }

  const db = await Database()
  const screenshotTestRepo = db.getRepository(ScreenshotTest)

  const screenshotTest = await screenshotTestRepo.findOneBy({ id })
  if (!screenshotTest) {
    throw new Error("Screenshot test not found")
  }

  // Fetch all of the test results for this screenshot test
  const testResults = await screenshotTest.testResults

  res.json({
    id: screenshotTest.id,
    projectId: screenshotTest.projectId,
    buildNumber: screenshotTest.buildNumber,
    testResults,
    commitSha: screenshotTest.commitSha,
    branch: screenshotTest.branch,
    uploadId: screenshotTest.uploadId,
    status: screenshotTest.status,
    totalChanges: screenshotTest.totalChanges,
    createdAt: screenshotTest.createdAt,
    updatedAt: screenshotTest.updatedAt,
  })
}
