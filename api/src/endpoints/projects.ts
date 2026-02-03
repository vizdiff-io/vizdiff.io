import { randomBytes } from "crypto"
import { Project, User } from "shared"
import type { VCSProvider } from "shared"

import type { ProjectResponse } from "../apiTypes"
import { toSeconds } from "../conversions"
import { trackEvent, trackPageView } from "../customerio"
import { Database } from "../database"
import { MAX_PROJECTS_PER_USER, TRIAL_PERIOD_MS } from "../environment"
import { getParamInt } from "../http"
import { log } from "../log"
import { getAccessibleProjectIds } from "../projectAccess"
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
  owner_subscription_plan: string | null
  owner_trial_ends_at: Date | null
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
 * Fetches a project with its associated statistics
 * @param db Database connection
 * @param projectId Project ID to fetch stats for
 * @returns The project with its stats or null if not found
 */
async function getProjectWithStats(
  db: Awaited<ReturnType<typeof Database>>,
  projectId: number,
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
            "(SELECT COUNT(DISTINCT st2.build_number) FROM screenshot_tests st2 WHERE st2.project_id = st.projectId AND st2.status IN ('completed', 'no_changes', 'unapproved', 'approved')) as buildcount",
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
      "project.vcsProvider",
      "project.repoId",
      "project.repoUrl",
      "project.token",
      "project.createdAt",
      "project.user as owner_id",
      "user.subscriptionPlan as owner_subscription_plan",
      "user.trialEndsAt as owner_trial_ends_at",
      "latest_test.screatedAt as lastbuildstamp",
      "latest_test.buildcount as buildcount",
      "latest_test.tcount as testcount",
    ])
    .innerJoin("project.user", "user")
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
    hasActiveSubscription: userSubscriptionIsActive(
      project.owner_subscription_plan,
      project.owner_trial_ends_at,
    ),
    createdStampSec: toSeconds(project.project_created_at),
    lastBuildStampSec: project.lastbuildstamp ? toSeconds(project.lastbuildstamp) : 0,
    builds: parseInt(project.buildcount) || 0,
    tests: parseInt(project.testcount) || 0,
  }
}

export const create: RequestHandler = async (req, res) => {
  const { user, ownedProjectCount } = res.locals
  const body = req.body as Partial<CreateProjectBody> | undefined

  const name = body?.name
  // Support both new fields and legacy GitHub-specific fields
  // Type as string to allow runtime validation
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
  const vcsProvider: VCSProvider = vcsProviderRaw as VCSProvider

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

  if (ownedProjectCount >= MAX_PROJECTS_PER_USER) {
    res.status(400).json({ error: "Max projects reached" })
    return
  }

  const db = await Database()

  if (user.trialEndsAt == undefined) {
    // Start the trial period now that the user has created their first project
    user.trialEndsAt = new Date(Date.now() + TRIAL_PERIOD_MS)
    const userTable = db.getRepository(User)
    await userTable.save(user)
  }

  const project = new Project()
  project.name = name
  project.vcsProvider = vcsProvider
  project.repoId = repoId
  project.repoUrl = repoUrl
  project.user = user
  project.token = generateProjectToken()

  const projectTable = db.getRepository(Project)
  await projectTable.save(project)

  // Track the project creation event with Customer.io
  trackEvent(user.id, req, "project_created", {
    projectName: project.name,
    vcsProvider: project.vcsProvider,
    repo: project.repoUrl,
    plan: user.subscriptionPlan,
  })

  const response: ProjectResponse = {
    id: project.id,
    name: project.name,
    vcsProvider: project.vcsProvider,
    repoUrl: project.repoUrl,
    githubRepoUrl: project.repoUrl, // Legacy alias
    token: project.token,
    ownerId: user.id,
    hasActiveSubscription: userSubscriptionIsActive(user.subscriptionPlan, user.trialEndsAt),
    createdStampSec: toSeconds(project.createdAt),
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

  // Track the project deletion event with Customer.io
  trackEvent(user.id, req, "project_deleted", {
    projectName: project.name,
    repo: project.repoUrl,
  })

  res.json({ success: true })
}

export const list: RequestHandler = async (_req, res) => {
  const { user } = res.locals

  const db = await Database()
  const projectTable = db.getRepository(Project)

  // Retrieve all project IDs the user has access to
  const projectIds = await getAccessibleProjectIds(db, user.id)
  if (projectIds.length === 0) {
    log.warn({ userId: user.id }, "User does not have access to any projects")
    res.json([])
    return
  }

  // Get the projects the user owns directly
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
            "(SELECT COUNT(DISTINCT st2.build_number) FROM screenshot_tests st2 WHERE st2.project_id = st.projectId AND st2.status IN ('completed', 'no_changes', 'unapproved', 'approved')) as buildcount",
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
      "project.vcsProvider",
      "project.repoId",
      "project.repoUrl",
      "project.token",
      "project.createdAt",
      "project.user as owner_id",
      "user.subscriptionPlan as owner_subscription_plan",
      "user.trialEndsAt as owner_trial_ends_at",
      "latest_test.screatedAt as lastbuildstamp",
      "latest_test.buildcount as buildcount",
      "latest_test.tcount as testcount",
    ])
    .innerJoin("project.user", "user")
    .where("project.id IN (:...projectIds)", { projectIds })
    .getRawMany<ProjectWithStats>()

  const responses: ProjectResponse[] = projectsWithStats.map(convertToProjectResponse)

  // Sort responses alphabetically by name, putting the user's own projects first
  responses.sort((a, b) => {
    if (a.ownerId === user.id && b.ownerId !== user.id) {
      return -1
    }
    if (a.ownerId !== user.id && b.ownerId === user.id) {
      return 1
    }
    return a.name.localeCompare(b.name)
  })

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

  // Permissions check
  const projectIds = await getAccessibleProjectIds(db, user.id)
  if (!projectIds.includes(id)) {
    log.error({ user, projectId: id, projectIds }, "Project not found in accessible projects")
    res.status(404).json({ error: "Project not found" })
    return
  }

  const projectWithStats = await getProjectWithStats(db, id)
  if (!projectWithStats) {
    log.error(
      { user, projectId: id, projectIds },
      "Project exists in accessible projects but DB retrieval failed",
    )
    res.status(404).json({ error: "Project not found" })
    return
  }

  const response = convertToProjectResponse(projectWithStats)

  trackPageView(user.id, req, `/project?id=${id}`, {
    name: response.name,
    repo: response.repoUrl,
    builds: response.builds,
    tests: response.tests,
    isProjectOwner: response.ownerId === user.id,
  })

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
  const projectWithStats = await getProjectWithStats(db, id)
  if (!projectWithStats) {
    // Failed to fetch the project with stats immediately after writing it. Should never happen
    log.error({ user, project }, "Failed to fetch project with stats after saving")
    res.status(500).json({ error: "Token reset failed" })
    return
  }

  const response = convertToProjectResponse(projectWithStats)
  res.json(response)
}

/** Generate a random 16-character hex string to use as a project token. */
function generateProjectToken(): string {
  return randomBytes(8).toString("hex") // 8 bytes = 16 hex chars
}

/** Returns true if the user has an active subscription or a trial that is still active. */
function userSubscriptionIsActive(
  subscriptionPlan: string | null,
  trialEndsAt: Date | null,
): boolean {
  return subscriptionPlan != undefined || (trialEndsAt != undefined && trialEndsAt > new Date())
}
