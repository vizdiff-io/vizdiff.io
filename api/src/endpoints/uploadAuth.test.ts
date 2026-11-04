import type { JWTPayload } from "jose"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { DefaultRequest, DefaultResponse } from "../types"
import { uploadStorybook } from "./upload"

const mocks = vi.hoisted(() => {
  const save = vi.fn().mockResolvedValue(undefined)
  const db = { getRepository: vi.fn(() => ({ save })) }
  return {
    db,
    save,
    database: vi.fn().mockResolvedValue(db),
    verify: vi.fn(),
    resolveProject: vi.fn(),
    getProjectByToken: vi.fn(),
    showProject: vi.fn(),
    s3Upload: vi.fn(),
    uploadDone: vi.fn().mockResolvedValue({}),
    createScreenshotTest: vi.fn(),
  }
})

vi.mock("../database", () => ({ Database: mocks.database }))
vi.mock("../authenticate", () => ({ getProjectByToken: mocks.getProjectByToken }))
vi.mock("../gitlabOidcProjects", () => ({ resolveOidcProject: mocks.resolveProject }))
vi.mock("../gitlabOidc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../gitlabOidc")>()),
  verifyGitLabIdToken: mocks.verify,
}))
vi.mock("../environment", () => ({
  APP_URL: "https://vizdiff.example.com",
  ENABLE_VCS_STATUS: false,
  GITHUB_ENABLED: false,
  GITLAB_HOST: "https://gitlab.com",
  S3_BUCKET_NAME: "test-uploads",
}))
vi.mock("../gitlab", () => ({
  getGitLabClient: vi.fn(() => ({ Projects: { show: mocks.showProject } })),
  getGitLabHostConfig: vi.fn(),
  updateGitLabCommitStatus: vi.fn(),
}))
vi.mock("../github", () => ({
  getInstallationForOrg: vi.fn(),
  getOctokitForInstallation: vi.fn(),
}))
vi.mock("../log", () => {
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  return { log: { child: vi.fn(() => logger) } }
})
vi.mock("../s3", () => ({ s3Client: vi.fn(() => ({})), deleteObjectsByPrefixes: vi.fn() }))
vi.mock("../screenshotTests", () => ({ createScreenshotTest: mocks.createScreenshotTest }))
vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: class {
    constructor(input: unknown) {
      mocks.s3Upload(input)
    }
    done = mocks.uploadDone
  },
}))

const sha = "a".repeat(40)
const baseSha = "b".repeat(40)
const project = {
  id: 7,
  key: "ui",
  repoId: 42,
  repoUrl: "https://gitlab.com/example/site",
  vcsProvider: "gitlab",
  gitlabHost: "https://gitlab.com",
  user: { id: 3 },
}

function claims(overrides: JWTPayload = {}): JWTPayload {
  return {
    project_id: "42",
    project_path: "example/site",
    sha,
    ref: "feature",
    ref_type: "branch",
    ref_protected: false,
    pipeline_source: "merge_request_event",
    ...overrides,
  }
}

async function upload({
  headers = {},
  query = {},
}: {
  headers?: Record<string, string>
  query?: Record<string, string>
} = {}) {
  const values: Record<string, string> = {
    "content-length": "123",
    authorization: "Bearer signed-token",
    "x-vizdiff-commit-sha": sha,
    "x-vizdiff-branch": "feature",
    "x-vizdiff-base-commit-sha": baseSha,
    "x-vizdiff-base-branch": "main",
    "x-vizdiff-pr-number": "19",
    ...headers,
  }
  const req = { query, header: (name: string) => values[name] } as DefaultRequest
  const res = { status: vi.fn(), json: vi.fn() }
  res.status.mockReturnValue(res)
  await uploadStorybook(req, res as unknown as DefaultResponse)
  return res
}

function expectNoUpload() {
  expect(mocks.s3Upload).not.toHaveBeenCalled()
  expect(mocks.createScreenshotTest).not.toHaveBeenCalled()
  expect(mocks.save).not.toHaveBeenCalled()
}

describe("storybook upload authentication boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("GITLAB_OIDC_AUTO_CREATE", "example/site=owner@example.com")
    mocks.verify.mockResolvedValue(claims())
    mocks.resolveProject.mockResolvedValue(project)
    mocks.getProjectByToken.mockResolvedValue(project)
    mocks.showProject.mockResolvedValue({ path_with_namespace: "example/site" })
    mocks.createScreenshotTest.mockResolvedValue({ id: 23 })
  })
  afterEach(() => vi.unstubAllEnvs())

  it("rejects invalid JWTs before resolving projects or uploading", async () => {
    mocks.verify.mockRejectedValueOnce(new Error("bad signature"))
    const res = await upload()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid GitLab CI ID token" })
    expect(mocks.verify).toHaveBeenCalledWith("signed-token", "https://vizdiff.example.com")
    expect(mocks.resolveProject).not.toHaveBeenCalled()
    expect(mocks.database).not.toHaveBeenCalled()
    expectNoUpload()
  })

  it.each(["Basic secret", "bearer signed-token", "Bearer"])(
    "rejects malformed authorization %s before verifying or uploading",
    async (authorization) => {
      const res = await upload({ headers: { authorization } })
      expect(res.status).toHaveBeenCalledWith(401)
      expect(mocks.verify).not.toHaveBeenCalled()
      expect(mocks.getProjectByToken).not.toHaveBeenCalled()
      expectNoUpload()
    },
  )

  it("rejects mixed static and bearer credentials", async () => {
    const res = await upload({ query: { token: "static-token" } })
    expect(res.status).toHaveBeenCalledWith(401)
    expect(mocks.verify).not.toHaveBeenCalled()
    expect(mocks.getProjectByToken).not.toHaveBeenCalled()
    expectNoUpload()
  })

  it("resolves the signed repository identity and requested monorepo key", async () => {
    const res = await upload({ query: { key: "docs" } })
    expect(mocks.resolveProject).toHaveBeenCalledWith(
      mocks.db,
      42,
      "example/site",
      "docs",
      new Map([["example/site", "owner@example.com"]]),
    )
    expect(mocks.getProjectByToken).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      uploadId: expect.any(String),
      testId: 23,
    })
    expect(mocks.s3Upload).toHaveBeenCalledOnce()
  })

  it("rejects unprotected baseline uploads before database creation", async () => {
    const res = await upload({ headers: { "x-vizdiff-pr-number": "" } })
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      error: "Baseline uploads require a protected branch pipeline",
    })
    expect(mocks.database).not.toHaveBeenCalled()
    expect(mocks.resolveProject).not.toHaveBeenCalled()
    expectNoUpload()
  })

  it("records MR uploads as ineligible for baseline promotion", async () => {
    await upload()
    expect(mocks.createScreenshotTest).toHaveBeenCalledWith(
      expect.objectContaining({ baselineEligible: false, prNumber: 19 }),
    )
    expect(mocks.save).toHaveBeenCalledTimes(2)
  })

  it("records protected push baselines as eligible", async () => {
    mocks.verify.mockResolvedValueOnce(
      claims({ ref: "main", ref_protected: "true", pipeline_source: "push" }),
    )
    const res = await upload({
      headers: {
        "x-vizdiff-branch": "main",
        "x-vizdiff-pr-number": "",
        "x-vizdiff-base-branch": "",
        "x-vizdiff-base-commit-sha": "",
      },
    })
    expect(res.status).not.toHaveBeenCalled()
    expect(mocks.createScreenshotTest).toHaveBeenCalledWith(
      expect.objectContaining({ baselineEligible: true, branch: "main" }),
    )
  })

  it.each([
    "https://gitlab.com/example/site.git",
    "git@gitlab.com:example/site.git",
    "https://gitlab.com/old-group/old-name",
  ])(
    "denies static credentials using canonical GitLab identity despite stored URL %s",
    async (repoUrl) => {
      mocks.getProjectByToken.mockResolvedValueOnce({ ...project, repoUrl })
      const res = await upload({ headers: { authorization: "" }, query: { token: "static-token" } })
      expect(mocks.showProject).toHaveBeenCalledWith(42)
      expect(res.status).toHaveBeenCalledWith(403)
      expect(mocks.database).not.toHaveBeenCalled()
      expectNoUpload()
    },
  )

  it("applies the configured gitlab.com host policy to legacy projects with no host", async () => {
    mocks.getProjectByToken.mockResolvedValueOnce({ ...project, gitlabHost: null })
    const res = await upload({ headers: { authorization: "" }, query: { token: "static-token" } })
    expect(mocks.showProject).toHaveBeenCalledWith(42)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(mocks.database).not.toHaveBeenCalled()
    expectNoUpload()
  })

  it.each([{}, { path_with_namespace: null }, { path_with_namespace: 42 }])(
    "fails closed with 503 for malformed canonical repository identity %j",
    async (canonical) => {
      mocks.showProject.mockResolvedValueOnce(canonical)
      const res = await upload({ headers: { authorization: "" }, query: { token: "static-token" } })
      expect(res.status).toHaveBeenCalledWith(503)
      expect(res.json).toHaveBeenCalledWith({ error: "Cannot verify repository upload policy" })
      expect(mocks.database).not.toHaveBeenCalled()
      expectNoUpload()
    },
  )

  it("preserves static uploads for repositories outside the OIDC allowlist", async () => {
    mocks.showProject.mockResolvedValueOnce({ path_with_namespace: "other/site" })
    const res = await upload({ headers: { authorization: "" }, query: { token: "static-token" } })
    expect(mocks.getProjectByToken).toHaveBeenCalledWith("static-token")
    expect(mocks.verify).not.toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
    expect(mocks.s3Upload).toHaveBeenCalledOnce()
  })

  it("fails closed with 503 when canonical repository lookup fails", async () => {
    mocks.showProject.mockRejectedValueOnce(new Error("GitLab unavailable"))
    const res = await upload({ headers: { authorization: "" }, query: { token: "static-token" } })
    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith({ error: "Cannot verify repository upload policy" })
    expect(mocks.database).not.toHaveBeenCalled()
    expectNoUpload()
  })
})
