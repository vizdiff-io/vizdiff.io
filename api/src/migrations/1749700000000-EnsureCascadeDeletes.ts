import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Ensure ON DELETE CASCADE on the foreign keys that make up the account-deletion object graph.
 *
 * Account deletion (`DELETE FROM users`) relies on Postgres FK cascades to remove the full graph:
 *
 *   users
 *     └─ projects (user_id)
 *          └─ screenshot_tests (project_id)
 *               ├─ test_results (screenshot_test_id)
 *               └─ task_queue (screenshot_test_id)
 *     ├─ github_installations (creator_id)
 *     └─ user_github_installations (user_id, installation_id)   [ManyToMany join table]
 *
 * A fresh database gets these FKs from the rebaselined InitialSchema1700000000000 migration
 * (nearly all already ON DELETE CASCADE; this migration upgrades the remaining
 * user_github_installations.user_id FK). Test schemas get them from `synchronize: true`, which
 * derives the delete rule from the entity `@ManyToOne({ onDelete: "CASCADE" })` decorators.
 * However, databases created before the rebaseline — or whose FKs were created at a point when a
 * relation lacked `onDelete: "CASCADE"`, or by an external tool — could be left with NO ACTION /
 * RESTRICT, which would either orphan child rows or abort the account-deletion transaction.
 *
 * This migration is defensive and idempotent: for each relationship it drops whatever FK currently
 * references the column and recreates it as ON DELETE CASCADE. It looks the constraint up by
 * (table, column) in the catalog rather than by a hard-coded name, because synchronize-generated
 * constraint names are content-hashed and differ between deployments.
 */
export class EnsureCascadeDeletes1749700000000 implements MigrationInterface {
  name = "EnsureCascadeDeletes1749700000000"

  // [child table, child column, parent table, parent column]
  static readonly #FKS: ReadonlyArray<readonly [string, string, string, string]> = [
    ["projects", "user_id", "users", "id"],
    ["screenshot_tests", "project_id", "projects", "id"],
    ["test_results", "screenshot_test_id", "screenshot_tests", "id"],
    ["task_queue", "screenshot_test_id", "screenshot_tests", "id"],
    ["github_installations", "creator_id", "users", "id"],
    ["user_github_installations", "user_id", "users", "id"],
    ["user_github_installations", "installation_id", "github_installations", "id"],
  ]

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column, refTable, refColumn] of EnsureCascadeDeletes1749700000000.#FKS) {
      await this.#recreateForeignKey(queryRunner, table, column, refTable, refColumn, "CASCADE")
    }
  }

  public async down(): Promise<void> {
    // No-op. Reverting to NO ACTION would re-introduce the orphan/abort hazard this migration fixes;
    // there is no safe automatic downgrade.
  }

  /**
   * Drop every FK constraint on `table(column)` and recreate a single one referencing
   * `refTable(refColumn)` with the requested delete rule. Skips silently if the table or column
   * does not exist (keeps the migration safe across partially-migrated schemas).
   */
  async #recreateForeignKey(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    refTable: string,
    refColumn: string,
    deleteRule: "CASCADE",
  ): Promise<void> {
    const tableExists = (await queryRunner.query(`SELECT to_regclass($1) AS reg`, [
      table,
    ])) as Array<{
      reg: string | null
    }>
    if (!tableExists[0]?.reg) {
      return
    }

    // Find existing FK constraints on this exact column (there should be at most one).
    const existing = (await queryRunner.query(
      `SELECT tc.constraint_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
          AND kcu.column_name = $2
          AND tc.table_schema = current_schema()`,
      [table, column],
    )) as Array<{ constraint_name: string }>

    for (const { constraint_name } of existing) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${constraint_name}"`,
      )
    }

    const fkName = `FK_${table}_${column}_cascade`
    await queryRunner.query(
      `ALTER TABLE "${table}"
         ADD CONSTRAINT "${fkName}"
         FOREIGN KEY ("${column}") REFERENCES "${refTable}" ("${refColumn}")
         ON DELETE ${deleteRule}`,
    )
  }
}
