import { ScreenshotTest, TestResult } from "shared"

import { Database } from "../database"
import { getParamInt } from "../http"
import type { DefaultRequest, DefaultResponse } from "../types"

export type ScreenshotTestResponse = {
  id: number
  projectId: number
  buildNumber: number
  commitSha: string
  branch: string
  baseCommitSha?: string
  baseBranch?: string
  uploadId: string
  status: "pending" | "running" | "completed"
  tag?: string
  initiatedStampSec: number
  buildDurationSec?: number
}

export type TestResultResponse = {
  id: number
  name: string
  changeStatus: "new" | "unchanged" | "changed"
  screenshotUrl: string
  ancestorScreenshotUrl?: string
  diffMaskUrl?: string
  createdStampSec: number
}

export type TestResponse = ScreenshotTestResponse & {
  parent?: ScreenshotTestResponse
  testResults: TestResultResponse[]
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
  const parent = parentScreenshotTest
    ? await screenshotTestToResponse(parentScreenshotTest)
    : undefined

  // Fetch all of the test results for this screenshot test
  const testResults = (await screenshotTest.testResults).map(testResultToResponse)

  const screenshotResponse = await screenshotTestToResponse(screenshotTest)
  res.json({ ...screenshotResponse, parent, testResults })
}

async function screenshotTestToResponse(
  screenshotTest: ScreenshotTest,
): Promise<ScreenshotTestResponse> {
  return {
    id: screenshotTest.id,
    projectId: screenshotTest.projectId,
    buildNumber: screenshotTest.buildNumber,
    commitSha: screenshotTest.commitSha,
    branch: screenshotTest.branch,
    uploadId: screenshotTest.uploadId,
    status: screenshotTest.status as "pending" | "running" | "completed",
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
    createdStampSec: testResult.createdAt.getTime() / 1000,
  }
}
