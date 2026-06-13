import { GitHubInstallation, Project, ScreenshotTest, TestResult, User, WorkTask } from "shared"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { Database } from "./database"

/**
 * Integration test for issue #83: deleting a User must cascade to the entire owned object graph
 * (Projects -> ScreenshotTests -> TestResults / WorkTasks) plus the GitHub access/installation rows,
 * leaving zero orphans. This exercises the real Postgres schema (synchronize in test, migrations in
 * prod) rather than a mock, so it verifies the actual ON DELETE CASCADE foreign keys.
 */
describe("account deletion cascade", () => {
  beforeAll(async () => {
    await Database()
  })

  afterAll(async () => {
    const db = await Database()
    if (db.isInitialized) {
      await db.destroy()
    }
  })

  it("cascades a full object graph and leaves no orphans", async () => {
    const db = await Database()

    // A second, unrelated user whose graph must remain untouched after the delete.
    const otherUserId = await db.transaction(async (manager) => {
      const other = manager.create(User, {
        authSubject: `keep-${Date.now()}-${Math.random()}`,
        authProvider: "dev",
        email: `keep-${Date.now()}-${Math.random()}@example.com`,
      })
      await manager.save(other)

      const otherProject = manager.create(Project, {
        user: other,
        name: "Keep Project",
        token: `keep-token-${Date.now()}-${Math.random()}`,
        vcsProvider: "github",
        repoId: Math.floor(Math.random() * 1_000_000_000),
        repoUrl: "https://github.com/keep/keep",
      })
      await manager.save(otherProject)
      return other.id
    })

    // Build the full graph for the user we will delete.
    const ids = await db.transaction(async (manager) => {
      const user = manager.create(User, {
        authSubject: `del-${Date.now()}-${Math.random()}`,
        authProvider: "dev",
        email: `del-${Date.now()}-${Math.random()}@example.com`,
      })
      await manager.save(user)

      const project = manager.create(Project, {
        user,
        name: "Delete Project",
        token: `del-token-${Date.now()}-${Math.random()}`,
        vcsProvider: "github",
        repoId: Math.floor(Math.random() * 1_000_000_000),
        repoUrl: "https://github.com/del/del",
      })
      await manager.save(project)

      const screenshotTest = manager.create(ScreenshotTest, {
        project,
        buildNumber: 1,
        commitSha: "abc123",
        branch: "main",
        uploadId: `upload-${Date.now()}-${Math.random()}`,
        status: "completed",
      })
      await manager.save(screenshotTest)

      const testResult = manager.create(TestResult, {
        name: "story-1",
        screenshotTest,
        storyId: "story-1",
        newImageUrl: `projects/${project.id}/screenshots/x/story-1.png`,
        changeStatus: "new",
      })
      await manager.save(testResult)

      const workTask = manager.create(WorkTask, {
        screenshotTest,
        taskType: "ingest_storybook",
        data: { projectId: project.id, uploadId: screenshotTest.uploadId },
      })
      await manager.save(workTask)

      // GitHub installation created by this user, plus a ManyToMany access row.
      const installation = manager.create(GitHubInstallation, {
        installationId: Math.floor(Math.random() * 1_000_000_000),
        accountId: `acct-${Date.now()}`,
        accountName: "del-org",
        accountType: "Organization",
        creatorId: user.id,
        users: [user],
      })
      await manager.save(installation)

      return {
        userId: user.id,
        projectId: project.id,
        screenshotTestId: screenshotTest.id,
        testResultId: testResult.id,
        workTaskId: workTask.id,
        installationId: installation.id,
      }
    })

    // Sanity: the join-table row exists before deletion.
    const joinBefore = await db.query(
      `SELECT COUNT(*)::int AS n FROM user_github_installations WHERE user_id = $1`,
      [ids.userId],
    )
    expect(joinBefore[0]?.n).toBe(1)

    // Delete the user exactly as the deleteAccount endpoint does.
    const user = await db.getRepository(User).findOneByOrFail({ id: ids.userId })
    await db.transaction(async (manager) => {
      await manager.remove(user)
    })

    // Assert zero orphans across every descendant table.
    const orphanQueries: Array<[string, string, number]> = [
      ["users", `SELECT COUNT(*)::int AS n FROM users WHERE id = $1`, ids.userId],
      ["projects", `SELECT COUNT(*)::int AS n FROM projects WHERE id = $1`, ids.projectId],
      [
        "screenshot_tests",
        `SELECT COUNT(*)::int AS n FROM screenshot_tests WHERE id = $1`,
        ids.screenshotTestId,
      ],
      [
        "test_results",
        `SELECT COUNT(*)::int AS n FROM test_results WHERE id = $1`,
        ids.testResultId,
      ],
      ["task_queue", `SELECT COUNT(*)::int AS n FROM task_queue WHERE id = $1`, ids.workTaskId],
      [
        "github_installations",
        `SELECT COUNT(*)::int AS n FROM github_installations WHERE id = $1`,
        ids.installationId,
      ],
      [
        "user_github_installations",
        `SELECT COUNT(*)::int AS n FROM user_github_installations WHERE user_id = $1`,
        ids.userId,
      ],
    ]

    for (const [label, sql, param] of orphanQueries) {
      const rows = await db.query(sql, [param])
      expect(rows[0]?.n, `expected zero orphaned rows in ${label}`).toBe(0)
    }

    // The unrelated user's graph must be untouched.
    const otherStillThere = await db.query(
      `SELECT COUNT(*)::int AS n FROM projects WHERE user_id = $1`,
      [otherUserId],
    )
    expect(otherStillThere[0]?.n).toBe(1)
  })
})
