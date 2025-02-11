import { Project } from "shared"

import type { ProjectResponse } from "../apiTypes"
import { getUser } from "../authenticate"
import { Database } from "../database"
import { getParamInt } from "../http"
import type { DefaultRequest, DefaultResponse } from "../types"

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

export async function create(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  const name = req.body.name as string | undefined
  const githubRepoUrl = req.body.githubRepoUrl as string | undefined

  if (!name) {
    throw new Error("Missing name")
  }
  if (!githubRepoUrl) {
    throw new Error("Missing githubRepoUrl")
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

export async function remove(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  const id = getParamInt("id", req)
  if (!id) {
    throw new Error("Missing id")
  }

  const db = await Database()
  const projectTable = db.getRepository(Project)
  const project = await projectTable.findOneBy({ id, user: { id: user.id } })

  if (!project) {
    throw new Error("Project not found")
  }

  await projectTable.remove(project)

  res.json({ success: true })
}

export async function list(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)

  const db = await Database()
  const projectTable = db.getRepository(Project)

  // This query gets project stats by:
  // 1. Finding the most recent ScreenshotTest for each project using ROW_NUMBER()
  // 2. Pre-aggregating test counts to avoid correlated subqueries
  // 3. Counting total number of builds across all time
  // Uses window functions and derived tables for better performance on large datasets
  const projectsWithStats = await projectTable
    .createQueryBuilder("project")
    .leftJoin(
      (qb) =>
        qb
          .select([
            "st.projectId as pid",
            "st.id as sid",
            "st.createdAt as screatedAt",
            "COALESCE(tc.testcount, 0) as tcount",
          ])
          .from(
            (subQuery) =>
              subQuery
                .select([
                  "screenshot_tests.id as id",
                  "screenshot_tests.project_id as projectId",
                  "screenshot_tests.created_at as createdAt",
                  "ROW_NUMBER() OVER (PARTITION BY screenshot_tests.project_id ORDER BY screenshot_tests.created_at DESC) as rn",
                ])
                .from("screenshot_tests", "screenshot_tests")
                .orderBy("screenshot_tests.created_at", "DESC"),
            "st",
          )
          .leftJoin(
            (subQuery) =>
              subQuery
                .select([
                  "tr.screenshot_test_id as screenshotTestId",
                  "COUNT(DISTINCT tr.name) as testcount",
                ])
                .from("test_results", "tr")
                .groupBy("tr.screenshot_test_id"),
            "tc",
            "tc.screenshotTestId = st.id",
          )
          .where("st.rn = 1"),
      "latest_test",
      "latest_test.pid = project.id",
    )
    .leftJoin("project.screenshotTests", "screenshotTest")
    .select([
      "project.id",
      "project.name",
      "project.githubRepoUrl",
      "project.token",
      "project.createdAt",
      "latest_test.screatedAt as lastbuildstamp",
      "COUNT(DISTINCT screenshotTest.id) as buildcount",
      "latest_test.tcount as testcount",
    ])
    .where("project.user = :userId", { userId: user.id })
    .groupBy("project.id")
    .addGroupBy("latest_test.screatedAt")
    .addGroupBy("latest_test.tcount")
    .getRawMany<ProjectWithStats>()

  const responses: ProjectResponse[] = projectsWithStats.map((project) => ({
    id: project.project_id,
    name: project.project_name,
    githubRepoUrl: project.project_github_repo_url,
    token: project.project_token,
    createdStampSec: project.project_created_at.getTime() / 1000,
    lastBuildStampSec: project.lastbuildstamp ? project.lastbuildstamp.getTime() / 1000 : 0,
    builds: parseInt(project.buildcount) || 0,
    tests: parseInt(project.testcount) || 0,
  }))
  res.json(responses)
}

export async function get(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  const id = getParamInt("id", req)
  if (!id) {
    throw new Error("Missing id")
  }

  const db = await Database()
  const projectTable = db.getRepository(Project)
  const project = await projectTable.findOneBy({ id, user: { id: user.id } })

  if (!project) {
    throw new Error("Project not found")
  }

  res.json(project)
}

export async function resetToken(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  const id = getParamInt("id", req)
  if (!id) {
    throw new Error("Missing id")
  }

  const db = await Database()
  const projectTable = db.getRepository(Project)
  const project = await projectTable.findOneBy({ id, user: { id: user.id } })

  if (!project) {
    throw new Error("Project not found")
  }

  project.token = generateProjectToken()
  await projectTable.save(project)

  res.json(project)
}

/** Generate a random 12-character hex string to use as a project token. */
function generateProjectToken(): string {
  return [...Array<undefined>(12)].map(() => Math.floor(Math.random() * 16).toString(16)).join("")
}
