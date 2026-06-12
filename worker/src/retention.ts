import { ScreenshotTest } from "shared"
import type { DataSource } from "typeorm"

import { Database } from "./database"
import {
  RETENTION_DAYS,
  RETENTION_KEEP_LAST_N,
  RETENTION_MAX_BUILDS_PER_SWEEP,
} from "./environment"
import { log } from "./log"
import { deleteObjectsByPrefixes } from "./s3"

/** A build selected for reaping, with the data needed to delete its S3 objects. */
interface ReapableBuild {
  id: number
  project_id: number
  upload_id: string
}

export interface RetentionSweepResult {
  buildsDeleted: number
  objectsDeleted: number
  objectErrors: number
}

/**
 * Select screenshot builds that are eligible for deletion (#79): older than the retention window
 * AND beyond the most-recent N builds for their project. In-flight builds (`pending` / `running`)
 * are never selected, so a build currently being processed can never be reaped out from under the
 * worker.
 *
 * Recency is ranked per project by `created_at DESC, id DESC` (id breaks ties deterministically).
 * The keep-last-N guard is applied *before* the age filter, so a project that builds rarely keeps
 * its N most recent builds even if every one of them is older than the window.
 */
export async function selectReapableBuilds(
  db: DataSource,
  options: { retentionDays: number; keepLastN: number; limit: number },
): Promise<ReapableBuild[]> {
  const cutoff = new Date(Date.now() - options.retentionDays * 24 * 60 * 60 * 1000)

  // Window function ranks each build within its project; the outer query keeps only builds ranked
  // beyond keepLastN that are also older than the cutoff. Terminal statuses only.
  const rows: unknown = await db.query(
    `
    WITH ranked AS (
      SELECT
        id,
        project_id,
        upload_id,
        created_at,
        ROW_NUMBER() OVER (
          PARTITION BY project_id
          ORDER BY created_at DESC, id DESC
        ) AS rn
      FROM screenshot_tests
      WHERE status NOT IN ('pending', 'running')
    )
    SELECT id, project_id, upload_id
    FROM ranked
    WHERE rn > $1
      AND created_at < $2
    ORDER BY created_at ASC, id ASC
    LIMIT $3
    `,
    [options.keepLastN, cutoff, options.limit],
  )

  return rows as ReapableBuild[]
}

/**
 * Run one retention sweep: delete eligible builds' S3 screenshots, then delete the build rows
 * (TestResults + WorkTasks cascade via FK). S3 deletion happens first and the row is only removed
 * after, so a crash mid-sweep leaves the row to be retried next sweep rather than orphaning S3
 * objects with no DB pointer. Deletion is idempotent.
 */
export async function runRetentionSweep(options?: {
  retentionDays?: number
  keepLastN?: number
  limit?: number
}): Promise<RetentionSweepResult> {
  const retentionDays = options?.retentionDays ?? RETENTION_DAYS
  const keepLastN = options?.keepLastN ?? RETENTION_KEEP_LAST_N
  const limit = options?.limit ?? RETENTION_MAX_BUILDS_PER_SWEEP

  const db = await Database()
  const builds = await selectReapableBuilds(db, { retentionDays, keepLastN, limit })

  const result: RetentionSweepResult = { buildsDeleted: 0, objectsDeleted: 0, objectErrors: 0 }
  if (builds.length === 0) {
    return result
  }

  log.info(
    `Retention reaper: ${builds.length} build(s) eligible (retentionDays=${retentionDays}, keepLastN=${keepLastN})`,
  )

  const repo = db.getRepository(ScreenshotTest)

  for (const build of builds) {
    // All objects for a build live under `projects/<projectId>/screenshots/<uploadId>/`.
    const prefix = `projects/${build.project_id}/screenshots/${build.upload_id}/`
    try {
      const { deleted, errors } = await deleteObjectsByPrefixes([prefix])
      result.objectsDeleted += deleted
      result.objectErrors += errors

      // Remove the build row; TestResults and WorkTasks cascade via ON DELETE CASCADE.
      await repo.delete({ id: build.id })
      result.buildsDeleted += 1
    } catch (error) {
      // Never let one build abort the whole sweep; it will be retried next tick.
      log.error(
        error,
        `Retention reaper: failed to reap build ${build.id} (project ${build.project_id})`,
      )
    }
  }

  log.info(
    `Retention reaper: deleted ${result.buildsDeleted} build(s), ${result.objectsDeleted} S3 object(s), ${result.objectErrors} object error(s)`,
  )
  return result
}
