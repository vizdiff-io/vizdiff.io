import { Gitlab } from "@gitbeaker/rest"
import type { GitLabHostConfig } from "shared"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import {
  getGitLabClient,
  getGitLabHostConfig,
  updateGitLabCommitStatus,
  type GitLabStatusState,
} from "./gitlab"

// Mock external dependencies
vi.mock("@gitbeaker/rest")
vi.mock("./environment", () => ({
  GITLAB_HOST: "https://gitlab.com",
  APP_URL: "https://vizdiff.io",
  ENABLE_VCS_STATUS: false, // Disabled in tests by default
  IS_PRODUCTION: false,
  IS_STAGING: false,
  IS_TEST: true,
}))

// Configure per-host service tokens before the module's lazy/cached parse of process.env.
process.env.GITLAB_HOSTS = JSON.stringify([
  { host: "https://gitlab.com", token: "glpat-service-token", rejectUnauthorized: true },
  { host: "https://gitlab.company.com", token: "glpat-corp-token", rejectUnauthorized: false },
])

describe("gitlab (worker)", () => {
  let mockGitlabClient: {
    Commits: { editStatus: ReturnType<typeof vi.fn> }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockGitlabClient = {
      Commits: {
        editStatus: vi.fn().mockResolvedValue({}),
      },
    }

    // vitest 4 invokes mock implementations with `new`, so the implementation
    // must be a constructable `function` rather than a (non-constructable) arrow.
    vi.mocked(Gitlab).mockImplementation(function (this: unknown) {
      return mockGitlabClient as unknown as InstanceType<typeof Gitlab>
    } as unknown as typeof Gitlab)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("getGitLabHostConfig", () => {
    it("resolves the configured token for a host", () => {
      expect(getGitLabHostConfig("https://gitlab.com")?.token).toBe("glpat-service-token")
    })

    it("returns undefined for an unconfigured host", () => {
      expect(getGitLabHostConfig("https://gitlab.unknown.example.com")).toBeUndefined()
    })
  })

  describe("getGitLabClient", () => {
    it("creates a client using the host config's service token", () => {
      const cfg: GitLabHostConfig = {
        host: "https://gitlab.com",
        token: "glpat-service-token",
        rejectUnauthorized: true,
      }
      getGitLabClient(cfg)
      expect(Gitlab).toHaveBeenCalledWith(
        expect.objectContaining({ host: "https://gitlab.com", token: "glpat-service-token" }),
      )
    })
  })

  describe("updateGitLabCommitStatus", () => {
    it("skips update when ENABLE_VCS_STATUS is false", async () => {
      await updateGitLabCommitStatus({
        projectId: 123,
        commitSha: "abc123",
        gitlabHost: "https://gitlab.com",
        state: "success",
        testId: 1,
        name: "vizdiff/visual-tests",
        description: "All tests passed",
      })

      expect(mockGitlabClient.Commits.editStatus).not.toHaveBeenCalled()
    })
  })

  describe("GitLabStatusState type", () => {
    it("includes all valid states", () => {
      const validStates: GitLabStatusState[] = [
        "pending",
        "running",
        "success",
        "failed",
        "canceled",
      ]
      expect(validStates).toHaveLength(5)
    })
  })
})
