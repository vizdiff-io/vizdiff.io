import { ScreenshotTest, screenshotsKeyPrefix, uploadTarballKey } from "shared"
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
 *
 * Builds that a *retained* build references as its baseline are also protected (#338): a retained
 * build's `TestResult.baseline_image_url` points at the baseline build's S3 objects
 * (`.../screenshots/<uploadId>/...`, see worker/src/stories.ts), so deleting that baseline build
 * would leave the retained comparison view / MR comment unable to presign its baseline images. A
 * candidate is therefore excluded from deletion whenever its `upload_id` is referenced by the
 * baseline of any build that is not itself a reaping candidate. This is conservative: a baseline
 * is only reaped once every build that still references it is also eligible to be reaped.
 */
export async function selectReapableBuilds(
  db: DataSource,
  options: { retentionDays: number; keepLastN: number; limit: number },
): Promise<ReapableBuild[]> {
  const cutoff = new Date(Date.now() - options.retentionDays * 24 * 60 * 60 * 1000)

  // `ranked` ranks each build within its project; `candidates` are the builds ranked beyond
  // keepLastN that are also older than the cutoff (terminal statuses only). The final SELECT drops
  // any candidate whose objects are still referenced as a baseline by a *retained* build — i.e. a
  // build that is NOT itself a candidate (it survives keep-last-N / the cutoff, or is in-flight).
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
    ),
    candidates AS (
      SELECT id, project_id, upload_id, created_at
      FROM ranked
      WHERE rn > $1
        AND created_at < $2
    )
    SELECT c.id, c.project_id, c.upload_id
    FROM candidates c
    WHERE NOT EXISTS (
      SELECT 1
      FROM test_results tr
      JOIN screenshot_tests referrer ON referrer.id = tr.screenshot_test_id
      WHERE referrer.id <> c.id
        -- The baseline build whose objects are referenced (upload_id is unique, so the
        -- screenshots/<upload_id>/ path segment identifies exactly one build).
        AND tr.baseline_image_url LIKE '%screenshots/' || c.upload_id || '/%'
        -- Only retained referrers protect the baseline; a referrer that is itself a candidate is
        -- being reaped too, so it no longer needs the baseline preserved.
        AND NOT EXISTS (SELECT 1 FROM candidates cc WHERE cc.id = referrer.id)
    )
    ORDER BY c.created_at ASC, c.id ASC
    LIMIT $3
    `,
    [options.keepLastN, cutoff, options.limit],
  )

  return rows as ReapableBuild[]
}

/**
 * Run one retention sweep: delete eligible builds' S3 objects (screenshots and the uploaded
 * storybook tarball), then delete the build rows
 * (TestResults + WorkTasks cascade via FK). S3 deletion happens first and the row is only removed
 * after, so a crash mid-sweep leaves the row to be retried next sweep rather than orphaning S3
 * objects with no DB pointer. Deletion is idempotent.
 *
 * A build whose S3 deletion reports any per-object errors (`errors > 0`) is treated as a failed
 * reap (#338): its DB row is left in place so a later sweep can retry, rather than orphaning the
 * objects that survived. This preserves the S3-before-DB safety property even on partial failure.
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
    // Reap both the build's screenshots prefix and its uploaded storybook tarball (written by the
    // api upload endpoint, read once by ingest) so tarballs don't leak forever. Key layout lives
    // in shared/src/s3Keys.ts.
    const screenshotsPrefix = screenshotsKeyPrefix(build.project_id, build.upload_id)
    const tarballKey = uploadTarballKey(build.project_id, build.upload_id)
    try {
      const { deleted, errors } = await deleteObjectsByPrefixes([screenshotsPrefix, tarballKey])
      result.objectsDeleted += deleted
      result.objectErrors += errors

      if (errors > 0) {
        // Partial S3 failure: leave the DB row so a later sweep retries the surviving objects,
        // rather than orphaning them with no row to find them by (S3-before-DB safety property).
        log.warn(
          `Retention reaper: ${errors} S3 object error(s) deleting build ${build.id} (project ${build.project_id}); keeping its row for retry`,
        )
        continue
      }

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
