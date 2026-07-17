import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Two index fixes for `screenshot_tests` / `test_results`:
 *
 * 1. `test_results.screenshot_test_id` had no index. It is the hottest foreign key in the schema:
 *    the build viewer, approval flow, webhook approval, worker ingest/retention, and every
 *    `ON DELETE CASCADE` from `screenshot_tests` all filter `test_results` by it, and
 *    `test_results` is the largest table.
 *
 * 2. Build numbers were assigned with a read-MAX-then-insert pattern and nothing enforced their
 *    uniqueness, so concurrent uploads to the same project could be assigned the same
 *    `build_number`. A unique index on (project_id, build_number) closes the race at the database
 *    layer (the insert path retries on unique-violation; see api/src/screenshotTests.ts).
 *
 * Because duplicates may already exist in databases that hit the race, a defensive pre-pass
 * renumbers them first: for each (project_id, build_number) group the earliest row (lowest id)
 * keeps its number and every later duplicate is moved to a fresh number above the project's
 * current maximum, preserving id order.
 *
 * Index names match the entity `@Index` decorators so `synchronize: true` (tests) and migrations
 * produce identical schemas. `IF NOT EXISTS` keeps both statements idempotent.
 */
export class AddTestResultAndBuildNumberIndexes1751000000000 implements MigrationInterface {
  name = "AddTestResultAndBuildNumberIndexes1751000000000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_test_results_screenshot_test_id"
         ON "test_results" ("screenshot_test_id")`,
    )

    // Renumber any pre-existing duplicate (project_id, build_number) pairs before adding the
    // unique index. Each duplicate beyond the first in a group gets the next number above the
    // project's current max, assigned in id order so renumbering is deterministic.
    await queryRunner.query(
      `WITH dups AS (
         SELECT id, project_id,
                ROW_NUMBER() OVER (PARTITION BY project_id, build_number ORDER BY id) AS rn
           FROM screenshot_tests
       ),
       maxes AS (
         SELECT project_id, MAX(build_number) AS max_build_number
           FROM screenshot_tests
          GROUP BY project_id
       ),
       to_fix AS (
         SELECT d.id,
                m.max_build_number + ROW_NUMBER() OVER (PARTITION BY d.project_id ORDER BY d.id)
                  AS new_build_number
           FROM dups d
           JOIN maxes m ON m.project_id = d.project_id
          WHERE d.rn > 1
       )
       UPDATE screenshot_tests st
          SET build_number = f.new_build_number
         FROM to_fix f
        WHERE st.id = f.id`,
    )

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_project_id_build_number"
         ON "screenshot_tests" ("project_id", "build_number")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The duplicate renumbering is not reverted; it only ever made build numbers unique.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_project_id_build_number"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_test_results_screenshot_test_id"`)
  }
}
