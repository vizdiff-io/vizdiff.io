import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Self-host migration.
 *
 * Transforms the multi-tenant SaaS schema into the self-hostable schema:
 *  - Adds AuthProvider identity columns to `users` (`auth_subject`, `auth_provider`, `display_name`).
 *  - Drops Stripe/trial/subscription columns and GitLab OAuth token/identity columns from `users`.
 *  - Drops the now-dead access/membership tables.
 *  - Re-keys the projects uniqueness to (vcs_provider, repo_id, gitlab_host).
 *
 * DATA CAVEAT: re-keying project uniqueness to drop the per-creator dimension means that if two
 * users previously created VizDiff projects for the same repo, the unique index creation will fail
 * until the duplicates are de-duplicated. See docs/CONFIGURATION.md for the de-dupe procedure.
 *
 * This migration is written to be idempotent-friendly with IF EXISTS / IF NOT EXISTS guards so it
 * can run against schemas previously managed by `synchronize: true`.
 */
export class SelfHost1717000000000 implements MigrationInterface {
  name = "SelfHost1717000000000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- users: add AuthProvider identity columns ---
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_subject" text`)
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_provider" text`)
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" text`)

    // Backfill auth_subject for any pre-existing rows so the NOT NULL/unique constraints can be
    // applied. Prefer a stable existing identifier; fall back to a synthetic per-row value.
    await queryRunner.query(`
      UPDATE "users"
      SET "auth_subject" = COALESCE(
        "auth_subject",
        CASE
          WHEN "gitlab_id" IS NOT NULL THEN 'gitlab:' || "gitlab_id"
          WHEN "github_id" IS NOT NULL THEN 'github:' || "github_id"
          ELSE 'legacy:' || "id"::text
        END
      )
    `)
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "auth_subject" SET NOT NULL`)
    await queryRunner.query(
      `DO $$ BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = 'UQ_users_auth_subject'
         ) THEN
           ALTER TABLE "users" ADD CONSTRAINT "UQ_users_auth_subject" UNIQUE ("auth_subject");
         END IF;
       END $$;`,
    )
    // Backfill display_name from any retained profile/username data.
    await queryRunner.query(`
      UPDATE "users"
      SET "display_name" = COALESCE("display_name", "github_username", "gitlab_username")
      WHERE "display_name" IS NULL
    `)

    // --- users: drop SaaS / VCS-OAuth columns ---
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "stripe_customer_id"`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "stripe_subscription_id"`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "subscription_plan"`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "subscription_interval"`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "trial_ends_at"`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "gitlab_access_token"`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "gitlab_refresh_token"`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "gitlab_profile"`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "gitlab_id"`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "gitlab_username"`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "gitlab_host"`)

    // --- drop dead access/membership tables ---
    await queryRunner.query(`DROP TABLE IF EXISTS "user_github_repo_access"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "user_gitlab_project_access"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "user_gitlab_groups"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "gitlab_groups"`)

    // --- projects: re-key uniqueness to (vcs_provider, repo_id, gitlab_host) ---
    // COALESCE the host so NULL (all GitHub rows, plus legacy GitLab rows) participates in
    // uniqueness. Postgres treats NULLs as distinct in a plain unique index, which would let
    // duplicate projects for the same repo slip through. The empty string is not a valid host,
    // so it is a safe sentinel. (Avoids a hard dependency on PG15+ `NULLS NOT DISTINCT`.)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_vcs_repo"`)
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vcs_repo_host" ON "projects" ("vcs_provider", "repo_id", (COALESCE("gitlab_host", '')))`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Best-effort reversal. The dropped SaaS data is not recoverable.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vcs_repo_host"`)
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_vcs_repo" ON "projects" ("user_id", "vcs_provider", "repo_id")`,
    )

    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gitlab_host" text`)
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gitlab_username" text`)
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gitlab_id" text`)
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gitlab_profile" jsonb`)
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gitlab_refresh_token" text`,
    )
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gitlab_access_token" text`,
    )
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamptz`,
    )
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_interval" text`,
    )
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_plan" text`)
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text`,
    )
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text`,
    )

    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UQ_users_auth_subject"`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "display_name"`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "auth_provider"`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "auth_subject"`)
  }
}
