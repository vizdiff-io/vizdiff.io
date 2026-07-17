import { Project, ScreenshotTest } from "shared"

import { Database } from "./database"

export type CreateScreenshotTestData = {
  project: Project
  commitSha: string
  branch: string
  uploadId: string
  baseCommitSha?: string
  baseBranch?: string
  githubCheckRunId?: number
  prNumber?: number
}

/**
 * Number of attempts to insert a screenshot test before giving up. Build numbers are assigned by
 * reading MAX(build_number) and inserting MAX+1, so two concurrent uploads can compute the same
 * number; the unique index on (project_id, build_number) rejects the loser, which simply recomputes
 * and retries.
 */
const MAX_BUILD_NUMBER_ATTEMPTS = 3

/** True when `error` is a Postgres unique-violation (23505) on the build-number unique index. */
function isBuildNumberConflict(error: unknown): boolean {
  const err = error as {
    code?: string
    constraint?: string
    driverError?: { code?: string; constraint?: string }
  }
  const code = err.code ?? err.driverError?.code
  const constraint = err.constraint ?? err.driverError?.constraint
  return code === "23505" && (constraint == undefined || constraint.includes("build_number"))
}

export async function createScreenshotTest({
  project,
  commitSha,
  branch,
  uploadId,
  baseCommitSha,
  baseBranch,
  githubCheckRunId,
  prNumber,
}: CreateScreenshotTestData): Promise<ScreenshotTest> {
  if (!commitSha || !branch || !uploadId) {
    throw new Error("Missing required parameters")
  }

  // Start a transaction to retrieve the previous highest build number and create the new
  // screenshot test. A concurrent upload may claim the same build number first (rejected by the
  // unique index on project_id + build_number), in which case we recompute MAX and retry.
  const db = await Database()
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.transaction(async (manager) => {
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
        screenshotTest.project = project
        screenshotTest.buildNumber = buildNumber
        screenshotTest.commitSha = commitSha
        screenshotTest.branch = branch
        screenshotTest.baseCommitSha = baseCommitSha ?? null
        screenshotTest.baseBranch = baseBranch ?? null
        screenshotTest.prNumber = prNumber ?? null
        screenshotTest.uploadId = uploadId
        screenshotTest.status = "pending"
        screenshotTest.githubCheckRunId = githubCheckRunId ?? null

        return await manager.save(screenshotTest)
      })
    } catch (error) {
      if (attempt >= MAX_BUILD_NUMBER_ATTEMPTS || !isBuildNumberConflict(error)) {
        throw error
      }
    }
  }
}
