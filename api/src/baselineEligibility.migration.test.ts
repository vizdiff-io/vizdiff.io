import { afterAll, expect, it } from "vitest"

import { Database } from "./database"
import { AddBaselineEligibility1757000000000 } from "./migrations/1757000000000-AddBaselineEligibility"

afterAll(async () => {
  const db = await Database()
  if (db.isInitialized) {
    await db.destroy()
  }
})
it("preserves legacy eligibility and persists explicit untrusted uploads across migration", async () => {
  const db = await Database()
  const runner = db.createQueryRunner()
  await runner.connect()
  try {
    // A temporary table shadows the real table only on this connection.
    await runner.query("CREATE TEMP TABLE screenshot_tests (id integer)")
    await runner.query("INSERT INTO screenshot_tests VALUES (1)")
    const migration = new AddBaselineEligibility1757000000000()
    await migration.up(runner)
    expect(await runner.query("SELECT baseline_eligible FROM screenshot_tests")).toEqual([
      { baseline_eligible: true },
    ])
    await runner.query("INSERT INTO screenshot_tests VALUES (2, false)")
    expect(await runner.query("SELECT baseline_eligible FROM screenshot_tests WHERE id=2")).toEqual(
      [{ baseline_eligible: false }],
    )
    await expect(runner.query("INSERT INTO screenshot_tests VALUES (3, null)")).rejects.toThrow()
    await migration.down(runner)
    expect(await runner.query("SELECT * FROM screenshot_tests ORDER BY id")).toEqual([
      { id: 1 },
      { id: 2 },
    ])
  } finally {
    await runner.query("DROP TABLE IF EXISTS pg_temp.screenshot_tests")
    await runner.release()
  }
})
