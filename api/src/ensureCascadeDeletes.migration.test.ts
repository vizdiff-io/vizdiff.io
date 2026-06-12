import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { Database } from "./database"
import { EnsureCascadeDeletes1749700000000 } from "./migrations/1749700000000-EnsureCascadeDeletes"

/**
 * Verifies the defensive cascade migration repairs a foreign key that is missing ON DELETE CASCADE.
 * The synchronized test schema already has cascades, so we first downgrade the projects -> users FK
 * to NO ACTION, then run the migration and assert it was restored to CASCADE.
 */
describe("EnsureCascadeDeletes migration", () => {
  beforeAll(async () => {
    await Database()
  })

  afterAll(async () => {
    const db = await Database()
    if (db.isInitialized) {
      await db.destroy()
    }
  })

  async function deleteRuleFor(table: string, column: string): Promise<string | undefined> {
    const db = await Database()
    const rows: unknown = await db.query(
      `SELECT rc.delete_rule
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
         JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
          AND kcu.column_name = $2
          AND tc.table_schema = current_schema()`,
      [table, column],
    )
    return (rows as Array<{ delete_rule: string }>)[0]?.delete_rule
  }

  it("restores ON DELETE CASCADE on a downgraded foreign key", async () => {
    const db = await Database()
    const queryRunner = db.createQueryRunner()
    try {
      // Downgrade projects.user_id FK to NO ACTION, simulating a drifted production schema.
      const existing = (await queryRunner.query(
        `SELECT tc.constraint_name
           FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = 'projects'
            AND kcu.column_name = 'user_id'
            AND tc.table_schema = current_schema()`,
      )) as Array<{ constraint_name: string }>
      for (const { constraint_name } of existing) {
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "${constraint_name}"`)
      }
      await queryRunner.query(
        `ALTER TABLE "projects" ADD CONSTRAINT "FK_projects_user_id_noaction"
           FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE NO ACTION`,
      )

      expect(await deleteRuleFor("projects", "user_id")).toBe("NO ACTION")

      // Run the migration's up() and confirm the cascade is restored.
      await new EnsureCascadeDeletes1749700000000().up(queryRunner)

      expect(await deleteRuleFor("projects", "user_id")).toBe("CASCADE")

      // Running it again is idempotent.
      await new EnsureCascadeDeletes1749700000000().up(queryRunner)
      expect(await deleteRuleFor("projects", "user_id")).toBe("CASCADE")
    } finally {
      await queryRunner.release()
    }
  })
})
