import { TestResult } from "shared"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { approveOrDeny } from "./approval"

const mocks = vi.hoisted(() => {
  const queryBuilder = {
    innerJoinAndSelect: vi.fn(),
    where: vi.fn(),
    getOne: vi.fn(),
  }
  queryBuilder.innerJoinAndSelect.mockReturnValue(queryBuilder)
  queryBuilder.where.mockReturnValue(queryBuilder)
  return {
    queryBuilder,
    save: vi.fn().mockResolvedValue(undefined),
    find: vi.fn(),
    db: { getRepository: vi.fn(), transaction: vi.fn() },
    getGitLabHostConfig: vi.fn(),
    updateGitLabCommitStatus: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock("../database", () => ({ Database: vi.fn().mockResolvedValue(mocks.db) }))
vi.mock("../environment", () => ({
  APP_URL: "https://vizdiff.example.com",
  ENABLE_VCS_STATUS: true,
  GITHUB_ENABLED: false,
  GITLAB_HOST: "https://gitlab.com",
}))
vi.mock("../gitlab", () => ({
  getGitLabHostConfig: mocks.getGitLabHostConfig,
  updateGitLabCommitStatus: mocks.updateGitLabCommitStatus,
}))
vi.mock("../github", () => ({
  getInstallationForOrg: vi.fn(),
  getOctokitForInstallation: vi.fn(),
}))
vi.mock("../log", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock("../s3", () => ({ buildImageUrlResolver: vi.fn() }))

const GITLAB_HOST = "https://gitlab.example.com"
const sha = "a".repeat(40)

function makeTest(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    status: "unapproved",
    commitSha: sha,
    // The worker posted a `failed` "awaiting review" status for this build and stored no
    // status id; approval must still post the final GitLab state.
    vcsStatusId: null,
    project: {
      id: 1,
      key: "web",
      repoId: 42,
      repoUrl: "https://gitlab.example.com/acme/site",
      vcsProvider: "gitlab",
      gitlabHost: GITLAB_HOST,
    },
    toString: () => "build 7",
    ...overrides,
  }
}

async function callApproveOrDeny(status: string) {
  const req = { params: { id: "7", status } }
  const res = { status: vi.fn(), json: vi.fn(), locals: { user: { id: 3 } } }
  res.status.mockReturnValue(res)
  await approveOrDeny(
    req as unknown as Parameters<typeof approveOrDeny>[0],
    res as unknown as Parameters<typeof approveOrDeny>[1],
  )
  return res
}

describe("approveOrDeny GitLab commit status", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.db.transaction.mockImplementation(
      async (publish: (manager: unknown) => Promise<void>) =>
        await publish({
          query: vi.fn().mockResolvedValue([]),
          getRepository: mocks.db.getRepository,
        }),
    )
    mocks.db.getRepository.mockImplementation((entity: unknown) =>
      entity === TestResult
        ? { find: mocks.find }
        : { createQueryBuilder: () => mocks.queryBuilder, save: mocks.save },
    )
    mocks.getGitLabHostConfig.mockReturnValue({
      host: GITLAB_HOST,
      token: "test-token",
      rejectUnauthorized: true,
    })
    mocks.find.mockResolvedValue([{ diffRatio: 0.1 }, { diffRatio: 0.2 }, { diffRatio: 0 }])
  })

  it("approval posts success under the same status name the worker used", async () => {
    mocks.queryBuilder.getOne.mockResolvedValue(makeTest())

    const res = await callApproveOrDeny("approved")

    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ status: "approved" }))
    expect(mocks.updateGitLabCommitStatus).toHaveBeenCalledTimes(1)
    expect(mocks.updateGitLabCommitStatus).toHaveBeenCalledWith(42, sha, "success", {
      name: "vizdiff/visual-tests/web",
      targetUrl: "https://vizdiff.example.com/build?id=7",
      description: "2 visual changes approved",
      host: GITLAB_HOST,
    })
    expect(res.json).toHaveBeenCalledWith({ success: true })
  })

  it("denial posts failed with the denied description", async () => {
    mocks.queryBuilder.getOne.mockResolvedValue(makeTest())

    const res = await callApproveOrDeny("denied")

    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ status: "denied" }))
    expect(mocks.updateGitLabCommitStatus).toHaveBeenCalledWith(42, sha, "failed", {
      name: "vizdiff/visual-tests/web",
      targetUrl: "https://vizdiff.example.com/build?id=7",
      description: "2 visual changes denied",
      host: GITLAB_HOST,
    })
    expect(res.json).toHaveBeenCalledWith({ success: true })
  })

  it("approving a previously denied build still posts success", async () => {
    mocks.queryBuilder.getOne.mockResolvedValue(makeTest({ status: "denied", vcsStatusId: 1 }))
    mocks.find.mockResolvedValue([{ diffRatio: 0.5 }])

    await callApproveOrDeny("approved")

    expect(mocks.updateGitLabCommitStatus).toHaveBeenCalledWith(
      42,
      sha,
      "success",
      expect.objectContaining({
        name: "vizdiff/visual-tests/web",
        description: "1 visual change approved",
      }),
    )
  })
})
