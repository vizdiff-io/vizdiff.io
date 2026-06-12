import { Gitlab } from "@gitbeaker/rest"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { getGitLabClient, getGitLabHostConfig, updateGitLabCommitStatus } from "./gitlab"

// Mock external dependencies before importing the module under test.
vi.mock("@gitbeaker/rest")
vi.mock("./environment", () => ({
  GITLAB_HOST: "https://gitlab.com",
  IS_TEST: true,
  IS_PRODUCTION: false,
}))

// Configure a service-token host before the module reads process.env.
process.env.GITLAB_HOSTS = JSON.stringify([
  { host: "https://gitlab.com", token: "glpat-service-token", rejectUnauthorized: true },
  { host: "https://gitlab.corp.example.com", token: "glpat-corp-token", rejectUnauthorized: false },
])

describe("gitlab (api) service-token resolution", () => {
  let mockGitlabClient: { Commits: { editStatus: ReturnType<typeof vi.fn> } }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGitlabClient = {
      Commits: { editStatus: vi.fn().mockResolvedValue({}) },
    }
    // vitest 4 invokes mock implementations with `new`, so the implementation
    // must be a constructable `function` rather than a (non-constructable) arrow.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- cast keeps the constructable function form vitest 4 requires
    vi.mocked(Gitlab).mockImplementation(function (this: unknown) {
      return mockGitlabClient as unknown as InstanceType<typeof Gitlab>
    } as unknown as typeof Gitlab)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("getGitLabHostConfig", () => {
    it("resolves the configured token for an exact host match", () => {
      const cfg = getGitLabHostConfig("https://gitlab.com")
      expect(cfg?.token).toBe("glpat-service-token")
      expect(cfg?.rejectUnauthorized).toBe(true)
    })

    it("resolves a self-signed on-prem host", () => {
      const cfg = getGitLabHostConfig("https://gitlab.corp.example.com")
      expect(cfg?.token).toBe("glpat-corp-token")
      expect(cfg?.rejectUnauthorized).toBe(false)
    })

    it("returns undefined for an unconfigured host", () => {
      expect(getGitLabHostConfig("https://gitlab.unknown.example.com")).toBeUndefined()
    })
  })

  describe("getGitLabClient", () => {
    it("creates a client with the configured service token", () => {
      getGitLabClient("https://gitlab.com")
      expect(Gitlab).toHaveBeenCalledWith(
        expect.objectContaining({ host: "https://gitlab.com", token: "glpat-service-token" }),
      )
    })

    it("throws for an unconfigured host", () => {
      expect(() => getGitLabClient("https://gitlab.unknown.example.com")).toThrow(
        /No GitLab service token configured/,
      )
    })
  })

  describe("updateGitLabCommitStatus", () => {
    it("posts a commit status using the resolved service token", async () => {
      await updateGitLabCommitStatus(123, "abc123", "success", {
        name: "vizdiff/visual-tests",
        targetUrl: "https://vizdiff.io/build?id=1",
        description: "All good",
        host: "https://gitlab.com",
      })
      expect(mockGitlabClient.Commits.editStatus).toHaveBeenCalledWith(
        123,
        "abc123",
        "success",
        expect.objectContaining({ name: "vizdiff/visual-tests" }),
      )
    })

    it("propagates API errors", async () => {
      mockGitlabClient.Commits.editStatus.mockRejectedValueOnce(new Error("API error"))
      await expect(
        updateGitLabCommitStatus(123, "abc123", "success", {
          name: "vizdiff/visual-tests",
          targetUrl: "https://vizdiff.io/build?id=1",
          description: "All good",
          host: "https://gitlab.com",
        }),
      ).rejects.toThrow("API error")
    })
  })
})
