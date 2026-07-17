import { randomBytes } from "crypto"
import { Project } from "shared"
import type { VCSProvider } from "shared"

import type { ProjectResponse } from "../apiTypes"
import { toSeconds } from "../conversions"
import { Database } from "../database"
import { GITLAB_HOST } from "../environment"
import { getParamInt } from "../http"
import { log } from "../log"
import { deleteObjectsByPrefixes, projectKeyPrefix } from "../s3"
import type { RequestHandler } from "../types"

type ProjectWithStats = {
  project_id: number
  project_name: string
  project_vcs_provider: VCSProvider
  project_repo_id: number
  project_repo_url: string
  project_token: string
  project_created_at: Date
  owner_id: number
  lastbuildstamp: Date | null
  buildcount: string
  testcount: string
}

type CreateProjectBody = {
  name: string
  vcsProvider?: VCSProvider
  repoId?: number
  repoUrl?: string
  // Legacy fields (backward compatibility)
  githubRepoId?: number
  githubRepoUrl?: string
}

/**
 * Build the common project-with-stats SELECT. Callers add their own WHERE clause.
 */
function baseProjectStatsQuery(db: Awaited<ReturnType<typeof Database>>) {
  return db
    .getRepository(Project)
    .createQueryBuilder("project")
    .leftJoin(
      (qb) =>
        qb
          .select([
            "st.projectId as pid",
            "MAX(st.id) as sid",
            "MAX(st.createdAt) as screatedAt",
            "MAX(tc.testcount) as tcount", // Use MAX instead of SUM to get only the latest test count
            "(SELECT COUNT(DISTINCT st2.build_number) FROM screenshot_tests st2 WHERE st2.project_id = st.projectId AND st2.status IN ('no_changes', 'unapproved', 'approved')) as buildcount",
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
                .where("screenshot_tests.status IN ('no_changes', 'unapproved', 'approved')")
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
      "project.vcsProvider",
      "project.repoId",
      "project.repoUrl",
      "project.token",
      "project.createdAt",
      "project.user as owner_id",
      "latest_test.screatedAt as lastbuildstamp",
      "latest_test.buildcount as buildcount",
      "latest_test.tcount as testcount",
    ])
    .innerJoin("project.user", "user")
}

/**
 * Fetches a single project with its associated statistics.
 */
async function getProjectWithStats(
  db: Awaited<ReturnType<typeof Database>>,
  projectId: number,
): Promise<ProjectWithStats | null> {
  const projectsWithStats = await baseProjectStatsQuery(db)
    .where("project.id = :projectId", { projectId })
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
    vcsProvider: project.project_vcs_provider,
    repoUrl: project.project_repo_url,
    githubRepoUrl: project.project_repo_url, // Legacy alias
    token: project.project_token,
    ownerId: project.owner_id,
    createdStampSec: toSeconds(project.project_created_at),
    lastBuildStampSec: project.lastbuildstamp ? toSeconds(project.lastbuildstamp) : 0,
    builds: parseInt(project.buildcount) || 0,
    tests: parseInt(project.testcount) || 0,
  }
}

export const create: RequestHandler = async (req, res) => {
  const { user } = res.locals
  const body = req.body as Partial<CreateProjectBody> | undefined

  const name = body?.name
  // Support both new fields and legacy GitHub-specific fields
  const vcsProviderRaw: string = body?.vcsProvider ?? "github"
  const repoId = body?.repoId ?? body?.githubRepoId
  const repoUrl = body?.repoUrl ?? body?.githubRepoUrl

  // Validate vcsProvider at runtime to prevent invalid values from being stored
  if (vcsProviderRaw !== "github" && vcsProviderRaw !== "gitlab") {
    res
      .status(400)
      .json({ error: `Invalid vcsProvider: "${vcsProviderRaw}". Must be "github" or "gitlab"` })
    return
  }
  const vcsProvider: VCSProvider = vcsProviderRaw

  if (!name) {
    res.status(400).json({ error: "Missing name" })
    return
  }
  if (!repoId) {
    res.status(400).json({ error: "Missing repoId (or githubRepoId)" })
    return
  }
  if (!repoUrl) {
    res.status(400).json({ error: "Missing repoUrl (or githubRepoUrl)" })
    return
  }

  const db = await Database()

  const project = new Project()
  project.name = name
  project.vcsProvider = vcsProvider
  project.repoId = repoId
  project.repoUrl = repoUrl
  // Retain the creator for audit purposes (authorization is now any-authenticated-user).
  project.user = user
  project.token = generateProjectToken()
  if (vcsProvider === "gitlab") {
    // Derive the host from the repo URL origin, falling back to the default host.
    project.gitlabHost = originFromUrl(repoUrl) ?? GITLAB_HOST
  }

  const projectTable = db.getRepository(Project)
  await projectTable.save(project)

  const response: ProjectResponse = {
    id: project.id,
    name: project.name,
    vcsProvider: project.vcsProvider,
    repoUrl: project.repoUrl,
    githubRepoUrl: project.repoUrl, // Legacy alias
    token: project.token,
    ownerId: user.id,
    createdStampSec: toSeconds(project.createdAt),
    lastBuildStampSec: 0,
    builds: 0,
    tests: 0,
  }
  res.json(response)
}

export const remove: RequestHandler = async (req, res) => {
  const id = getParamInt("id", req)
  if (!id) {
    res.status(400).json({ error: "Missing id" })
    return
  }

  const db = await Database()
  const projectTable = db.getRepository(Project)
  const project = await projectTable.findOneBy({ id })

  if (!project) {
    res.status(404).json({ error: "Project not found" })
    return
  }

  await projectTable.remove(project)

  // Best-effort S3 cleanup of the project's screenshots (mirrors account deletion, see user.ts).
  // The DB rows are already gone, so an S3 failure must NOT fail the request; it is logged and left
  // for a later manual sweep or retry. Deletion is idempotent, so a retry is always safe.
  deleteObjectsByPrefixes([projectKeyPrefix(id)])
    .then(({ deleted, errors }) => {
      log.info(
        `Deleted screenshots for project ${id}: ${deleted} objects removed, ${errors} errors`,
      )
    })
    .catch((err: unknown) => {
      log.warn(err, `Failed to delete S3 screenshots for project ${id}`)
    })

  res.json({ success: true })
}

export const list: RequestHandler = async (_req, res) => {
  const db = await Database()

  // Any authenticated user can see all projects.
  const projectsWithStats = await baseProjectStatsQuery(db).getRawMany<ProjectWithStats>()

  const responses: ProjectResponse[] = projectsWithStats.map(convertToProjectResponse)

  // Sort alphabetically by name.
  responses.sort((a, b) => a.name.localeCompare(b.name))

  res.json(responses)
}

export const get: RequestHandler = async (req, res) => {
  const id = getParamInt("id", req)
  if (!id) {
    res.status(400).json({ error: "Missing id" })
    return
  }

  const db = await Database()

  const projectWithStats = await getProjectWithStats(db, id)
  if (!projectWithStats) {
    res.status(404).json({ error: "Project not found" })
    return
  }

  res.json(convertToProjectResponse(projectWithStats))
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
  const project = await projectTable.findOneBy({ id })
  if (!project) {
    res.status(404).json({ error: "Project not found" })
    return
  }

  project.token = generateProjectToken()
  await projectTable.save(project)

  // Get the updated project with stats
  const projectWithStats = await getProjectWithStats(db, id)
  if (!projectWithStats) {
    // Failed to fetch the project with stats immediately after writing it. Should never happen
    log.error({ user, project }, "Failed to fetch project with stats after saving")
    res.status(500).json({ error: "Token reset failed" })
    return
  }

  res.json(convertToProjectResponse(projectWithStats))
}

/** Generate a random 16-character hex string to use as a project token. */
function generateProjectToken(): string {
  return randomBytes(8).toString("hex") // 8 bytes = 16 hex chars
}

/** Return the origin (scheme://host[:port]) of a URL, or undefined if it cannot be parsed. */
function originFromUrl(url: string): string | undefined {
  try {
    return new URL(url).origin
  } catch {
    return undefined
  }
}
