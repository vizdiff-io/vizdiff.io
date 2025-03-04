import { Project, ScreenshotTest, TestResult } from "shared"

import type {
  ScreenshotTestResponse,
  ScreenshotTestSummaryResponse,
  TestResponse,
  TestResultResponse,
} from "../apiTypes"
import { Database } from "../database"
import { getParamInt } from "../http"
import { log } from "../log"
import type { RequestHandler } from "../types"

type ScreenshotTestWithStats = {
  screenshot_test_id: number
  screenshot_test_created_at: Date
  screenshot_test_git_branch: string
  screenshot_test_git_commit: string
  screenshot_test_base_commit_sha: string
  screenshot_test_base_branch: string
  screenshot_test_build_number: number
  screenshot_test_upload_id: string
  screenshot_test_status: string
  screenshot_test_tag: string
  testcount: string
  changecount: string
}

export const list: RequestHandler = async (req, res) => {
  const { user } = res.locals
  const projectId = getParamInt("projectId", req)
  if (!projectId) {
    res.status(400).json({ error: "Missing projectId" })
    return
  }

  const db = await Database()
  const projectTable = db.getRepository(Project)
  const project = await projectTable.findOneBy({ id: projectId, user: { id: user.id } })

  if (!project) {
    res.status(404).json({ error: "Project not found" })
    return
  }

  const screenshotTestTable = db.getRepository(ScreenshotTest)
  const screenshotTestsWithStats = await screenshotTestTable
    .createQueryBuilder("screenshot_test")
    .innerJoin(
      (qb) =>
        qb
          .select(["MAX(st.id) as latest_id", "st.build_number as build_number"])
          .from(ScreenshotTest, "st")
          .where("st.project_id = :projectId", { projectId })
          .groupBy("st.build_number"),
      "latest_tests",
      "latest_tests.latest_id = screenshot_test.id",
    )
    .leftJoin(
      (qb) =>
        qb
          .select([
            "tr.screenshotTestId as screenshotTestId",
            "COUNT(DISTINCT tr.testName) as testcount",
            "SUM(CASE WHEN tr.changeStatus = 'changed' OR tr.changeStatus = 'new' THEN 1 ELSE 0 END) as changecount",
          ])
          .from(
            (subQuery) =>
              subQuery
                .select([
                  "tr2.screenshot_test_id as screenshotTestId",
                  "tr2.name as testName",
                  "tr2.change_status as changeStatus",
                  "ROW_NUMBER() OVER (PARTITION BY tr2.screenshot_test_id, tr2.name ORDER BY tr2.id DESC) as rn",
                ])
                .from("test_results", "tr2"),
            "tr",
          )
          .where("tr.rn = 1")
          .groupBy("tr.screenshotTestId"),
      "test_counts",
      "test_counts.screenshotTestId = screenshot_test.id",
    )
    .select([
      "screenshot_test.id",
      "screenshot_test.createdAt",
      "screenshot_test.branch as screenshot_test_git_branch",
      "screenshot_test.commitSha as screenshot_test_git_commit",
      "screenshot_test.baseCommitSha as screenshot_test_base_commit_sha",
      "screenshot_test.baseBranch as screenshot_test_base_branch",
      "screenshot_test.buildNumber as screenshot_test_build_number",
      "screenshot_test.uploadId as screenshot_test_upload_id",
      "screenshot_test.status as screenshot_test_status",
      "screenshot_test.tag as screenshot_test_tag",
      "COALESCE(test_counts.testcount, '0') as testcount",
      "COALESCE(test_counts.changecount, '0') as changecount",
    ])
    .where("screenshot_test.project = :projectId", { projectId })
    .orderBy("screenshot_test.createdAt", "DESC")
    .getRawMany<ScreenshotTestWithStats>()

  const responses: ScreenshotTestSummaryResponse[] = screenshotTestsWithStats.map((test) => ({
    id: test.screenshot_test_id,
    projectId,
    githubRepoUrl: project.githubRepoUrl,
    buildNumber: test.screenshot_test_build_number,
    commitSha: test.screenshot_test_git_commit,
    branch: test.screenshot_test_git_branch,
    baseCommitSha: test.screenshot_test_base_commit_sha,
    baseBranch: test.screenshot_test_base_branch,
    uploadId: test.screenshot_test_upload_id,
    status: test.screenshot_test_status as ScreenshotTestResponse["status"],
    tag: test.screenshot_test_tag,
    initiatedStampSec: test.screenshot_test_created_at.getTime() / 1000,
    stories: parseInt(test.testcount) || 0,
    changes: parseInt(test.changecount) || 0,
  }))
  res.json(responses)
}

export const get: RequestHandler = async (req, res) => {
  // const { user } = res.locals
  const screenshotTestId = getParamInt("id", req)
  if (!screenshotTestId) {
    res.status(400).json({ error: "Missing id" })
    return
  }

  const db = await Database()

  const screenshotTestTable = db.getRepository(ScreenshotTest)
  const screenshotTest = await screenshotTestTable.findOneBy({ id: screenshotTestId })
  if (!screenshotTest) {
    log.error(`Screenshot test not found: id=${screenshotTestId}`)
    res.status(404).json({ error: "Screenshot test not found" })
    return
  }
  const projectId = screenshotTest.project.id

  const projectTable = db.getRepository(Project)
  const project = await projectTable.findOneBy({ id: projectId })
  if (!project) {
    log.error(`Project not found: projectId=${projectId}`)
    res.status(404).json({ error: "Project not found" })
    return
  }

  // Get the most recent test result for each test name
  const testResultTable = db.getRepository(TestResult)
  const testResults = await testResultTable
    .createQueryBuilder("result")
    .innerJoin(
      (qb) =>
        qb
          .select(["tr.name as name", "MAX(tr.id) as latest_id"])
          .from(TestResult, "tr")
          .where("tr.screenshot_test_id = :screenshotTestId", { screenshotTestId })
          .groupBy("tr.name"),
      "latest_results",
      "latest_results.latest_id = result.id",
    )
    .where("result.screenshotTest = :screenshotTestId", { screenshotTestId })
    .getMany()

  const response: TestResponse = {
    id: screenshotTest.id,
    projectId: screenshotTest.project.id,
    githubRepoUrl: project.githubRepoUrl,
    buildNumber: screenshotTest.buildNumber,
    commitSha: screenshotTest.commitSha,
    branch: screenshotTest.branch,
    baseCommitSha: screenshotTest.baseCommitSha,
    baseBranch: screenshotTest.baseBranch,
    uploadId: screenshotTest.uploadId,
    status: screenshotTest.status as ScreenshotTestResponse["status"],
    tag: screenshotTest.tag,
    initiatedStampSec: screenshotTest.createdAt.getTime() / 1000,
    buildDurationSec: screenshotTest.buildDurationSec,
    testResults: testResults.map((result) => ({
      id: result.id,
      name: result.name,
      changeStatus: result.changeStatus as TestResultResponse["changeStatus"],
      screenshotUrl: result.newImageUrl,
      ancestorScreenshotUrl: result.baselineImageUrl,
      diffMaskUrl: result.diffImageUrl,
      diffRatio: result.diffRatio,
      createdStampSec: result.createdAt.getTime() / 1000,
    })),
  }

  res.json(response)
}

export const listActivity: RequestHandler = async (_req, res) => {
  const { user } = res.locals
  const db = await Database()
  const screenshotTestTable = db.getRepository(ScreenshotTest)

  const screenshotTests = await screenshotTestTable
    .createQueryBuilder("screenshot_test")
    .innerJoinAndSelect("screenshot_test.project", "project")
    .innerJoin(
      // Subquery to get the latest screenshot test for each build number
      (qb) =>
        qb
          .select([
            "MAX(st.id) as latest_id",
            "st.project_id as project_id",
            "st.build_number as build_number",
          ])
          .from(ScreenshotTest, "st")
          .innerJoin("st.project", "p")
          .where("p.user_id = :userId", { userId: user.id })
          .groupBy("st.project_id")
          .addGroupBy("st.build_number"),
      "latest_tests",
      "latest_tests.latest_id = screenshot_test.id",
    )
    .leftJoin(
      (qb) =>
        qb
          .select([
            "tr.screenshotTestId as screenshotTestId",
            "COUNT(DISTINCT tr.testName) as testcount",
          ])
          .from(
            (subQuery) =>
              subQuery
                .select([
                  "tr2.screenshot_test_id as screenshotTestId",
                  "tr2.name as testName",
                  "ROW_NUMBER() OVER (PARTITION BY tr2.screenshot_test_id, tr2.name ORDER BY tr2.id DESC) as rn",
                ])
                .from("test_results", "tr2"),
            "tr",
          )
          .where("tr.rn = 1")
          .groupBy("tr.screenshotTestId"),
      "test_counts",
      "test_counts.screenshotTestId = screenshot_test.id",
    )
    .select([
      "screenshot_test.id",
      "screenshot_test.createdAt",
      "screenshot_test.branch",
      "screenshot_test.commitSha",
      "screenshot_test.baseCommitSha",
      "screenshot_test.baseBranch",
      "screenshot_test.buildNumber",
      "screenshot_test.uploadId",
      "screenshot_test.status",
      "screenshot_test.tag",
      "project.id as project_id",
      "project.github_repo_url as project_github_repo_url",
      "COALESCE(test_counts.testcount, '0') as testcount",
    ])
    .orderBy("screenshot_test.createdAt", "DESC")
    .take(10)
    .getRawMany<ScreenshotTestWithStats & { project_id: number; project_github_repo_url: string }>()

  const responses: ScreenshotTestResponse[] = screenshotTests.map((test) => ({
    id: test.screenshot_test_id,
    projectId: test.project_id,
    buildNumber: test.screenshot_test_build_number,
    githubRepoUrl: test.project_github_repo_url,
    commitSha: test.screenshot_test_git_commit,
    branch: test.screenshot_test_git_branch,
    baseCommitSha: test.screenshot_test_base_commit_sha,
    baseBranch: test.screenshot_test_base_branch,
    uploadId: test.screenshot_test_upload_id,
    status: test.screenshot_test_status as ScreenshotTestResponse["status"],
    tag: test.screenshot_test_tag,
    initiatedStampSec: test.screenshot_test_created_at.getTime() / 1000,
  }))
  res.json(responses)
}
