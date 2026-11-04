import "reflect-metadata"
import {
  defineRelationships,
  GitHubInstallation,
  Project,
  ScreenshotTest,
  TestResult,
  User,
  WorkerStatus,
  WorkTask,
} from "shared"
import { DataSource } from "typeorm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { deletePreviousTestResults, isBaselineBuildPending } from "./ingest"
import { fetchBaseTestResults } from "./shard"

let db: DataSource
vi.mock("./database", () => ({ Database: async () => db }))

const schema = `baseline_trust_${process.pid}`
let project: Project
let buildNumber = 0
const sha = "a".repeat(40)

async function build(overrides: Partial<ScreenshotTest> = {}): Promise<ScreenshotTest> {
  buildNumber += 1
  return await db.getRepository(ScreenshotTest).save({
    project,
    buildNumber,
    commitSha: sha,
    branch: "main",
    uploadId: `baseline-trust-${buildNumber}`,
    status: "approved",
    baselineEligible: true,
    ...overrides,
  })
}

async function result(screenshotTest: ScreenshotTest, storyId = "button"): Promise<TestResult> {
  return await db.getRepository(TestResult).save({
    screenshotTest,
    storyId,
    name: storyId,
    newImageUrl: `screenshots/${screenshotTest.uploadId}/${storyId}.png`,
    changeStatus: "new",
  })
}

beforeAll(async () => {
  db = new DataSource({
    type: "postgres",
    host: process.env.POSTGRES_HOST ?? "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    username: process.env.POSTGRES_USER ?? "postgres",
    password: process.env.POSTGRES_PASS ?? "postgres",
    database: process.env.POSTGRES_DATABASE ?? "vizdiff",
    schema,
    entities: [
      GitHubInstallation,
      Project,
      ScreenshotTest,
      TestResult,
      User,
      WorkTask,
      WorkerStatus,
    ],
  })
  await db.initialize()
  await db.query(`CREATE SCHEMA "${schema}"`)
  await db.synchronize()
  defineRelationships()
  const user = await db.getRepository(User).save({ authSubject: "baseline-trust-owner" })
  project = await db.getRepository(Project).save({
    user,
    name: "Example",
    token: "baseline-trust-project",
    vcsProvider: "gitlab",
    gitlabHost: "https://gitlab.com",
    repoId: 42,
    repoUrl: "https://gitlab.com/example/site",
  })
})

afterAll(async () => {
  if (db.isInitialized) {
    await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    await db.destroy()
  }
})

describe("baseline trust isolation", () => {
  it("never uses an MR-shaped unprotected upload at the protected commit SHA as a baseline", async () => {
    const trusted = await build()
    const trustedResult = await result(trusted)
    const untrusted = await build({
      branch: "feature",
      baselineEligible: false,
      prNumber: 7,
      baseBranch: "main",
      baseCommitSha: "b".repeat(40),
    })
    await result(untrusted)
    await result(untrusted, "untrusted-only-story")
    const comparison = await build({ commitSha: "c".repeat(40), baseCommitSha: sha })

    const baselines = await fetchBaseTestResults(comparison)
    expect([...baselines.keys()]).toEqual(["button"])
    expect(baselines.get("button")?.id).toBe(trustedResult.id)
    const filtered = await fetchBaseTestResults(comparison, ["untrusted-only-story"])
    expect(filtered.size).toBe(0)
  })

  it("does not defer a comparison for an untrusted same-SHA pending upload", async () => {
    const pendingSha = "d".repeat(40)
    const untrusted = await build({
      commitSha: pendingSha,
      status: "pending",
      baselineEligible: false,
    })
    const comparison = await build({ commitSha: "e".repeat(40), baseCommitSha: pendingSha })
    expect(await isBaselineBuildPending(comparison.id)).toBe(false)
    await db.getRepository(ScreenshotTest).update(untrusted.id, { baselineEligible: true })
    expect(await isBaselineBuildPending(comparison.id)).toBe(true)
  })

  it("keeps trusted same-branch results when an untrusted upload replaces earlier comparison results", async () => {
    const cleanupSha = "f".repeat(40)
    const trusted = await build({ commitSha: cleanupSha })
    const trustedResult = await result(trusted)
    const oldUntrusted = await build({ commitSha: cleanupSha, baselineEligible: false })
    const oldUntrustedResult = await result(oldUntrusted)
    const currentUntrusted = await build({ commitSha: cleanupSha, baselineEligible: false })
    const currentResult = await result(currentUntrusted)

    await deletePreviousTestResults(currentUntrusted)
    const results = db.getRepository(TestResult)
    expect(await results.existsBy({ id: trustedResult.id })).toBe(true)
    expect(await results.existsBy({ id: oldUntrustedResult.id })).toBe(false)
    expect(await results.existsBy({ id: currentResult.id })).toBe(true)
  })
})
