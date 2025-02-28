import { randomBytes } from "crypto"
import { Project } from "shared"

import type { ProjectResponse } from "../apiTypes"
import { Database } from "../database"
import { getParamInt } from "../http"
import type { RequestHandler } from "../types"

type ProjectWithStats = {
  project_id: number
  project_name: string
  project_github_repo_url: string
  project_token: string
  project_created_at: Date
  lastbuildstamp: Date | null
  buildcount: string
  testcount: string
}

type CreateProjectBody = {
  name: string
  githubRepoUrl: string
}

/**
 * Fetches a project with its associated statistics
 * @param db Database connection
 * @param projectId Project ID to fetch stats for
 * @param userId User ID for permission check
 * @returns The project with its stats or null if not found
 */
async function getProjectWithStats(
  db: Awaited<ReturnType<typeof Database>>,
  projectId: number,
  userId: number,
): Promise<ProjectWithStats | null> {
  const projectTable = db.getRepository(Project)

  const projectsWithStats = await projectTable
    .createQueryBuilder("project")
    .leftJoin(
      (qb) =>
        qb
          .select([
            "st.projectId as pid",
            "MAX(st.id) as sid",
            "MAX(st.createdAt) as screatedAt",
            "MAX(tc.testcount) as tcount", // Use MAX instead of SUM to get only the latest test count
            "COUNT(DISTINCT st.buildNumber) as buildcount",
          ])
          .from(
            (subQuery) =>
              subQuery
                .select([
                  "screenshot_tests.id as id",
                  "screenshot_tests.project_id as projectId",
                  "screenshot_tests.created_at as createdAt",
                  "screenshot_tests.build_number as buildNumber",
                  "ROW_NUMBER() OVER (PARTITION BY screenshot_tests.project_id ORDER BY screenshot_tests.created_at DESC) as rn",
                ])
                .from("screenshot_tests", "screenshot_tests")
                .where(
                  "screenshot_tests.status IN ('completed', 'no_changes', 'unapproved', 'approved')",
                )
                .orderBy("screenshot_tests.created_at", "DESC"),
            "st",
          )
          .leftJoin(
            (subQuery) =>
              subQuery
                .select([
                  "tr.screenshotTestId as screenshotTestId",
                  "COUNT(DISTINCT tr.testName) as testcount",
                ])
                .from(
                  (innerSubQuery) =>
                    innerSubQuery
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
            "tc",
            "tc.screenshotTestId = st.id",
          )
          .where("st.rn = 1")
          .groupBy("st.projectId"),
      "latest_test",
      "latest_test.pid = project.id",
    )
    .select([
      "project.id",
      "project.name",
      "project.githubRepoUrl",
      "project.token",
      "project.createdAt",
      "latest_test.screatedAt as lastbuildstamp",
      "latest_test.buildcount as buildcount",
      "latest_test.tcount as testcount",
    ])
    .where("project.id = :projectId AND project.user = :userId", { projectId, userId })
    .getRawOne<ProjectWithStats>()

  return projectsWithStats ?? null
}

/**
 * Convert a ProjectWithStats to a ProjectResponse
 */
function convertToProjectResponse(project: ProjectWithStats): ProjectResponse {
  return {
    id: project.project_id,
    name: project.project_name,
    githubRepoUrl: project.project_github_repo_url,
    token: project.project_token,
    createdStampSec: project.project_created_at.getTime() / 1000,
    lastBuildStampSec: project.lastbuildstamp ? project.lastbuildstamp.getTime() / 1000 : 0,
    builds: parseInt(project.buildcount) || 0,
    tests: parseInt(project.testcount) || 0,
  }
}

export const create: RequestHandler = async (req, res) => {
  const { user } = res.locals
  const body = req.body as Partial<CreateProjectBody>
  const name = body.name
  const githubRepoUrl = body.githubRepoUrl

  if (!name) {
    res.status(400).json({ error: "Missing name" })
    return
  }
  if (!githubRepoUrl) {
    res.status(400).json({ error: "Missing githubRepoUrl" })
    return
  }

  const project = new Project()
  project.name = name
  project.githubRepoUrl = githubRepoUrl
  project.user = user
  project.token = generateProjectToken()

  const db = await Database()
  const projectTable = db.getRepository(Project)
  await projectTable.save(project)

  const response: ProjectResponse = {
    id: project.id,
    name: project.name,
    githubRepoUrl: project.githubRepoUrl,
    token: project.token,
    createdStampSec: project.createdAt.getTime() / 1000,
    lastBuildStampSec: 0,
    builds: 0,
    tests: 0,
  }
  res.json(response)
}

export const remove: RequestHandler = async (req, res) => {
  const { user } = res.locals
  const id = getParamInt("id", req)
  if (!id) {
    res.status(400).json({ error: "Missing id" })
    return
  }

  const db = await Database()
  const projectTable = db.getRepository(Project)
  const project = await projectTable.findOneBy({ id, user: { id: user.id } })

  if (!project) {
    res.status(404).json({ error: "Project not found" })
    return
  }

  await projectTable.remove(project)
  res.json({ success: true })
}

export const list: RequestHandler = async (_req, res) => {
  const { user } = res.locals

  const db = await Database()
  const projectTable = db.getRepository(Project)

  // This query gets project stats by:
  // 1. Finding the most recent ScreenshotTest for each project
  // 2. Only counting tests from that build (not summing across all builds)
  // 3. Using window functions for better performance
  const projectsWithStats = await projectTable
    .createQueryBuilder("project")
    .leftJoin(
      (qb) =>
        qb
          .select([
            "st.projectId as pid",
            "MAX(st.id) as sid",
            "MAX(st.createdAt) as screatedAt",
            "MAX(tc.testcount) as tcount", // Use MAX instead of SUM to get count only from the latest build
            "COUNT(DISTINCT st.buildNumber) as buildcount",
          ])
          .from(
            (subQuery) =>
              subQuery
                .select([
                  "screenshot_tests.id as id",
                  "screenshot_tests.project_id as projectId",
                  "screenshot_tests.created_at as createdAt",
                  "screenshot_tests.build_number as buildNumber",
                  "ROW_NUMBER() OVER (PARTITION BY screenshot_tests.project_id ORDER BY screenshot_tests.created_at DESC) as rn",
                ])
                .from("screenshot_tests", "screenshot_tests")
                .where(
                  "screenshot_tests.status IN ('completed', 'no_changes', 'unapproved', 'approved')",
                )
                .orderBy("screenshot_tests.created_at", "DESC"),
            "st",
          )
          .leftJoin(
            (subQuery) =>
              subQuery
                .select([
                  "tr.screenshotTestId as screenshotTestId",
                  "COUNT(DISTINCT tr.testName) as testcount",
                ])
                .from(
                  (innerSubQuery) =>
                    innerSubQuery
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
            "tc",
            "tc.screenshotTestId = st.id",
          )
          .where("st.rn = 1")
          .groupBy("st.projectId"),
      "latest_test",
      "latest_test.pid = project.id",
    )
    .select([
      "project.id",
      "project.name",
      "project.githubRepoUrl",
      "project.token",
      "project.createdAt",
      "latest_test.screatedAt as lastbuildstamp",
      "latest_test.buildcount as buildcount",
      "latest_test.tcount as testcount",
    ])
    .where("project.user = :userId", { userId: user.id })
    .getRawMany<ProjectWithStats>()

  const responses: ProjectResponse[] = projectsWithStats.map(convertToProjectResponse)
  res.json(responses)
}

export const get: RequestHandler = async (req, res) => {
  const { user } = res.locals
  const id = getParamInt("id", req)
  if (!id) {
    res.status(400).json({ error: "Missing id" })
    return
  }

  const db = await Database()
  const projectWithStats = await getProjectWithStats(db, id, user.id)

  if (!projectWithStats) {
    res.status(404).json({ error: "Project not found" })
    return
  }

  const response = convertToProjectResponse(projectWithStats)
  res.json(response)
}

export const resetToken: RequestHandler = async (req, res) => {
  const { user } = res.locals
  const id = getParamInt("id", req)
  if (!id) {
    res.status(400).json({ error: "Missing id" })
    return
  }

  const db = await Database()
  const projectTable = db.getRepository(Project)
  const project = await projectTable.findOneBy({ id, user: { id: user.id } })

  if (!project) {
    res.status(404).json({ error: "Project not found" })
    return
  }

  project.token = generateProjectToken()
  await projectTable.save(project)

  // Get the updated project with stats
  const projectWithStats = await getProjectWithStats(db, id, user.id)

  if (!projectWithStats) {
    // Should never happen, but handle it gracefully
    const basicResponse: ProjectResponse = {
      id: project.id,
      name: project.name,
      githubRepoUrl: project.githubRepoUrl,
      token: project.token,
      createdStampSec: project.createdAt.getTime() / 1000,
      lastBuildStampSec: 0,
      builds: 0,
      tests: 0,
    }
    res.json(basicResponse)
    return
  }

  const response = convertToProjectResponse(projectWithStats)
  res.json(response)
}

/** Generate a random 16-character hex string to use as a project token. */
function generateProjectToken(): string {
  return randomBytes(8).toString("hex") // 8 bytes = 16 hex chars
}
