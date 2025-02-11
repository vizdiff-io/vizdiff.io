import { ScreenshotTest, TestResult } from "shared"

import type { ScreenshotTestResponse, TestResultResponse } from "../apiTypes"
import { getUserId } from "../authenticate"
import { Database } from "../database"
import { getParamInt } from "../http"
import type { DefaultRequest, DefaultResponse } from "../types"

export async function list(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const projectId = getParamInt("projectId", req)
  if (!projectId) {
    throw new Error("Missing projectId")
  }

  const db = await Database()
  const screenshotTestRepo = db.getRepository(ScreenshotTest)

  const screenshotTests = await screenshotTestRepo.find({
    where: { projectId },
    order: { buildNumber: "DESC" },
    take: 10,
  })

  const responses = await Promise.all(screenshotTests.map(screenshotTestToResponse))
  res.json(responses)
}

// Returns the 10 most recent screenshot tests across all projects for the current user
export async function listActivity(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const userId = getUserId(req)
  const db = await Database()
  const screenshotTestRepo = db.getRepository(ScreenshotTest)

  const screenshotTests = await screenshotTestRepo
    .createQueryBuilder("screenshotTest")
    .innerJoinAndSelect("screenshotTest.project", "project")
    .where("project.user_id = :userId", { userId })
    .orderBy("screenshotTest.createdAt", "DESC")
    .take(10)
    .getMany()

  const responses: ScreenshotTestResponse[] = screenshotTests.map(screenshotTestToResponse)
  res.json(responses)
}

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

  // Fetch the parent screenshot test, querying by projectId+commitSha
  const parentScreenshotTest = await screenshotTestRepo.findOneBy({
    projectId: screenshotTest.projectId,
    commitSha: screenshotTest.baseCommitSha,
  })
  const parent = parentScreenshotTest ? screenshotTestToResponse(parentScreenshotTest) : undefined

  // Fetch all of the test results for this screenshot test
  const testResults = (await screenshotTest.testResults).map(testResultToResponse)

  const screenshotResponse = screenshotTestToResponse(screenshotTest)
  res.json({ ...screenshotResponse, parent, testResults })
}

function screenshotTestToResponse(screenshotTest: ScreenshotTest): ScreenshotTestResponse {
  return {
    id: screenshotTest.id,
    projectId: screenshotTest.projectId,
    buildNumber: screenshotTest.buildNumber,
    commitSha: screenshotTest.commitSha,
    branch: screenshotTest.branch,
    uploadId: screenshotTest.uploadId,
    status: screenshotTest.status as ScreenshotTestResponse["status"],
    tag: undefined,
    initiatedStampSec: screenshotTest.createdAt.getTime() / 1000,
    buildDurationSec: screenshotTest.buildDurationSec,
  }
}

function testResultToResponse(testResult: TestResult): TestResultResponse {
  return {
    id: testResult.id,
    name: testResult.name,
    changeStatus: testResult.changeStatus as "new" | "unchanged" | "changed",
    screenshotUrl: testResult.newImageUrl,
    ancestorScreenshotUrl: testResult.baselineImageUrl,
    diffMaskUrl: testResult.diffImageUrl,
    diffRatio: testResult.diffRatio,
    createdStampSec: testResult.createdAt.getTime() / 1000,
  }
}
