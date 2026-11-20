/**
 * Final VCS status posted when a build completes, for every completion path that goes through
 * completeBuild(): the inline ingest (covered in worker.test.ts), the sharded reconcile winner
 * (reconcileAndComplete) and the sharded chunk give-up (giveUpOnChunkTask). Database access and
 * the GitHub/GitLab clients are mocked; the reconcile SQL itself is covered against a real
 * Postgres in shard.test.ts.
 */

import "reflect-metadata"
import type { PoolClient } from "pg"
import { ScreenshotTest, TestResult, type GitLabHostConfig } from "shared"
import type { DataSource } from "typeorm"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { approveOrDeny } from "../../api/src/endpoints/approval"
import { Database, DatabasePool } from "../src/database"
import { updateGitHubCheckRun, type GitHubCheckData } from "../src/github"
import { getGitLabHostConfig, updateGitLabCommitStatus, type GitLabCheckData } from "../src/gitlab"
import { completeBuild, giveUpOnChunkTask, reconcileAndComplete } from "../src/shard"

vi.mock("../src/database", () => ({
  Database: vi.fn(),
  DatabasePool: vi.fn(),
  closeDatabasePool: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../api/src/database", async () => ({
  Database: (await import("../src/database")).Database,
}))
vi.mock("../../api/src/environment", () => ({
  APP_URL: "https://vizdiff.example.com",
  ENABLE_VCS_STATUS: true,
  GITHUB_ENABLED: false,
  GITLAB_HOST: "https://gitlab.example.com",
}))
vi.mock("../../api/src/gitlab", async () => {
  const worker = await import("../src/gitlab")
  return {
    getGitLabHostConfig: worker.getGitLabHostConfig,
    updateGitLabCommitStatus: async (
      _projectId: number,
      _sha: string,
      state: string,
      options: object,
    ) =>
      await worker.updateGitLabCommitStatus({ ...gitlabCheckData, ...options, state } as Parameters<
        typeof worker.updateGitLabCommitStatus
      >[0]),
  }
})
vi.mock("../../api/src/github", () => ({}))
vi.mock("../../api/src/s3", () => ({}))
vi.mock("../../api/src/log", () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))

vi.mock("../src/gitlab", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/gitlab")>()),
  getGitLabHostConfig: vi.fn(),
  updateGitLabCommitStatus: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../src/github", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/github")>()),
  updateGitHubCheckRun: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../src/s3", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/s3")>()),
  buildImageUrlResolver: vi.fn().mockResolvedValue((stored: string | null) => stored),
}))

vi.mock("shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("shared")>()),
  createMarkdownForBuildResult: vi
    .fn()
    .mockReturnValue({ title: "title", summary: "summary", text: "text" }),
}))

const GITLAB_HOST = "https://gitlab.example.com"
const hostConfig: GitLabHostConfig = {
  host: GITLAB_HOST,
  token: "test-token",
  rejectUnauthorized: true,
}
const gitlabCheckData: GitLabCheckData = {
  projectId: 42,
  commitSha: "c0ffee",
  gitlabHost: GITLAB_HOST,
}
const githubCheckData: GitHubCheckData = {
  owner: "acme",
  repo: "site",
  checkRunId: 5,
  installationId: 6,
}

function makeBuild(): ScreenshotTest {
  return {
    id: 7,
    buildNumber: 3,
    status: "running",
    commitSha: gitlabCheckData.commitSha,
    project: { id: 1, key: "web", vcsProvider: "gitlab", gitlabHost: GITLAB_HOST },
    toString: () => "build 7",
  } as unknown as ScreenshotTest
}

function results(...statuses: string[]): TestResult[] {
  return statuses.map(
    (changeStatus, i) =>
      ({
        storyId: `story-${i}`,
        changeStatus,
        diffRatio: changeStatus === "unchanged" ? 0 : 0.1,
      }) as unknown as TestResult,
  )
}

let storedResults: TestResult[] = []
let storedBuild: ScreenshotTest | undefined
let findResults: () => Promise<TestResult[]>
let lockRequests: number

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function review(status: "approved" | "denied") {
  await approveOrDeny(
    { params: { id: "7", status } } as unknown as Parameters<typeof approveOrDeny>[0],
    { locals: { user: { id: 3 } }, json: vi.fn() } as unknown as Parameters<
      typeof approveOrDeny
    >[1],
  )
}

/** Fake pool client answering the reconcile UPDATE and the chunk-failure INSERT. */
function poolClient(reconciledStatus: "unapproved" | "no_changes"): PoolClient {
  return {
    query: vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO test_results")) {
        return { rows: [], rowCount: 1 }
      }
      if (sql.includes("UPDATE screenshot_tests")) {
        return { rows: [{ status: reconciledStatus }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    }),
    release: vi.fn(),
  } as unknown as PoolClient
}

beforeEach(() => {
  vi.clearAllMocks()
  storedResults = []
  storedBuild = makeBuild()
  findResults = async () => storedResults
  let lockTail = Promise.resolve()
  lockRequests = 0
  vi.mocked(getGitLabHostConfig).mockReturnValue(hostConfig)
  vi.mocked(Database).mockImplementation(async () => {
    const getRepository = (entity: unknown) => {
      if (entity === TestResult) {
        return { find: vi.fn().mockImplementation(() => findResults()) }
      }
      if (entity === ScreenshotTest) {
        const queryBuilder = {
          innerJoinAndSelect: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          getOne: vi
            .fn()
            .mockImplementation(async () => Object.assign(new ScreenshotTest(), storedBuild)),
        }
        return {
          findOneBy: vi.fn().mockImplementation(async () => storedBuild),
          createQueryBuilder: () => queryBuilder,
          save: vi.fn().mockImplementation(async (build: ScreenshotTest) => {
            storedBuild = build
          }),
        }
      }
      throw new Error("unexpected repository")
    }
    return {
      getRepository,
      transaction: async (publish: (manager: unknown) => Promise<unknown>) => {
        lockRequests++
        const previous = lockTail
        const unlocked = deferred()
        lockTail = unlocked.promise
        await previous
        try {
          return await publish({ query: vi.fn().mockResolvedValue([]), getRepository })
        } finally {
          unlocked.resolve()
        }
      },
    } as unknown as DataSource
  })
})

describe("completeBuild GitLab commit status", () => {
  it.each([
    ["inline", "approved"],
    ["inline", "denied"],
    ["sharded", "approved"],
    ["sharded", "denied"],
  ] as const)(
    "%s completion preserves %s while paused after the build transition",
    async (path, status) => {
      storedResults = results("changed")
      storedBuild!.status = "unapproved"
      const paused = deferred()
      const resume = deferred()
      findResults = async () => {
        paused.resolve()
        await resume.promise
        return storedResults
      }
      vi.mocked(DatabasePool).mockResolvedValue(poolClient("unapproved"))
      const complete = path === "inline" ? completeBuild : reconcileAndComplete
      const completion = complete(Object.assign(new ScreenshotTest(), storedBuild), {
        gitlabCheckData,
      })
      await paused.promise
      findResults = async () => storedResults
      await review(status)
      resume.resolve()
      await completion

      expect(storedBuild!.status).toBe(status)
      expect(updateGitLabCommitStatus).toHaveBeenLastCalledWith(
        expect.objectContaining({
          state: status === "approved" ? "success" : "failed",
          name: "vizdiff/visual-tests/web",
          description: `1 visual change ${status}`,
        }),
      )
    },
  )

  it("waits for an in-flight completion post before saving and publishing approval", async () => {
    storedResults = results("changed")
    storedBuild!.status = "unapproved"
    const posting = deferred()
    const resume = deferred()
    vi.mocked(updateGitLabCommitStatus).mockImplementationOnce(async () => {
      posting.resolve()
      await resume.promise
    })
    const completion = completeBuild(storedBuild!, { gitlabCheckData })
    await posting.promise
    const approval = review("approved")
    await vi.waitFor(() => expect(lockRequests).toBe(2))
    expect(storedBuild!.status).toBe("unapproved")
    expect(updateGitLabCommitStatus).toHaveBeenCalledTimes(1)
    resume.resolve()
    await Promise.all([completion, approval])

    expect(storedBuild!.status).toBe("approved")
    expect(updateGitLabCommitStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "success",
        name: "vizdiff/visual-tests/web",
        description: "1 visual change approved",
      }),
    )
  })

  it("posts failed with the awaiting-review count when the build has unapproved changes", async () => {
    storedResults = results("changed", "new", "unchanged")
    const build = makeBuild()
    build.status = "unapproved"

    await completeBuild(build, { gitlabCheckData })

    expect(updateGitLabCommitStatus).toHaveBeenCalledTimes(1)
    expect(updateGitLabCommitStatus).toHaveBeenCalledWith({
      ...gitlabCheckData,
      gitlabHost: GITLAB_HOST,
      state: "failed",
      testId: 7,
      name: "vizdiff/visual-tests/web",
      description: "2 visual changes awaiting review",
    })
  })

  it("uses the singular description for a single change", async () => {
    storedResults = results("failed", "unchanged")

    await completeBuild(makeBuild(), { gitlabCheckData })

    expect(updateGitLabCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({ state: "failed", description: "1 visual change awaiting review" }),
    )
  })

  it("posts success when nothing changed", async () => {
    storedResults = results("unchanged", "unchanged")

    await completeBuild(makeBuild(), { gitlabCheckData })

    expect(updateGitLabCommitStatus).toHaveBeenCalledTimes(1)
    expect(updateGitLabCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "success",
        name: "vizdiff/visual-tests/web",
        description: "No visual changes detected",
      }),
    )
  })

  it("leaves the GitHub check run flow unchanged (queued + action_required, no GitLab post)", async () => {
    storedResults = results("changed")

    await completeBuild(makeBuild(), { githubCheckData })

    expect(updateGitLabCommitStatus).not.toHaveBeenCalled()
    expect(updateGitHubCheckRun).toHaveBeenCalledWith(
      expect.objectContaining({
        ...githubCheckData,
        testId: 7,
        status: "queued",
        conclusion: "action_required",
      }),
    )
  })
})

describe("sharded completion GitLab commit status", () => {
  it("reconcile winner posts failed for an unapproved build", async () => {
    storedResults = results("changed", "changed", "changed")
    vi.mocked(DatabasePool).mockResolvedValue(poolClient("unapproved"))
    const build = makeBuild()

    const outcome = await reconcileAndComplete(build, { gitlabCheckData })

    expect(outcome).toEqual({ outcome: "won", status: "unapproved" })
    expect(build.status).toBe("unapproved")
    expect(updateGitLabCommitStatus).toHaveBeenCalledTimes(1)
    expect(updateGitLabCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "failed",
        testId: 7,
        name: "vizdiff/visual-tests/web",
        description: "3 visual changes awaiting review",
      }),
    )
  })

  it("chunk give-up that completes the build posts failed for an unapproved build", async () => {
    storedResults = results("changed", "failed")
    storedBuild = makeBuild()
    vi.mocked(DatabasePool).mockResolvedValue(poolClient("unapproved"))

    await giveUpOnChunkTask(7, {
      projectId: "1",
      uploadId: "u1",
      storyIds: ["story-0", "story-1"],
      chunkIndex: 0,
      chunkCount: 1,
      gitlabCheckData,
    })

    expect(updateGitLabCommitStatus).toHaveBeenCalledTimes(1)
    expect(updateGitLabCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        ...gitlabCheckData,
        state: "failed",
        name: "vizdiff/visual-tests/web",
        description: "2 visual changes awaiting review",
      }),
    )
  })
})
