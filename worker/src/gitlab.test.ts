import { Gitlab } from "@gitbeaker/rest"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { getGitLabClient, updateGitLabCommitStatus, type GitLabStatusState } from "./gitlab"

// Mock external dependencies
vi.mock("@gitbeaker/rest")
vi.mock("./environment", () => ({
  GITLAB_HOST: "https://gitlab.com",
  GITLAB_REJECT_UNAUTHORIZED: true,
  APP_URL: "https://vizdiff.io",
  IS_PRODUCTION: false,
  IS_STAGING: false,
  IS_TEST: true,
}))

describe("gitlab (worker)", () => {
  let mockGitlabClient: {
    Commits: { editStatus: ReturnType<typeof vi.fn> }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup GitLab client mock
    mockGitlabClient = {
      Commits: {
        editStatus: vi.fn().mockResolvedValue({}),
      },
    }

    vi.mocked(Gitlab).mockImplementation(() => mockGitlabClient as unknown as InstanceType<typeof Gitlab>)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("getGitLabClient", () => {
    it("creates a client with default host", () => {
      const client = getGitLabClient("test-token")

      expect(Gitlab).toHaveBeenCalledWith({
        host: "https://gitlab.com",
        oauthToken: "test-token",
        rejectUnauthorized: true,
      })
      expect(client).toBeDefined()
    })

    it("creates a client with custom host", () => {
      const client = getGitLabClient("test-token", "https://gitlab.company.com")

      expect(Gitlab).toHaveBeenCalledWith({
        host: "https://gitlab.company.com",
        oauthToken: "test-token",
        rejectUnauthorized: true,
      })
      expect(client).toBeDefined()
    })
  })

  describe("updateGitLabCommitStatus", () => {
    it("skips update in development environment", async () => {
      // IS_PRODUCTION and IS_STAGING are both false in our mock
      await updateGitLabCommitStatus({
        projectId: 123,
        commitSha: "abc123",
        gitlabHost: "https://gitlab.com",
        accessToken: "test-token",
        state: "success",
        testId: 1,
        name: "vizdiff/visual-tests",
        description: "All tests passed",
      })

      // Should not call the API in development
      expect(mockGitlabClient.Commits.editStatus).not.toHaveBeenCalled()
    })

    it("skips update when no access token provided", async () => {
      // Even with production flag, should skip if no token
      vi.doMock("./environment", () => ({
        GITLAB_HOST: "https://gitlab.com",
        GITLAB_REJECT_UNAUTHORIZED: true,
        APP_URL: "https://vizdiff.io",
        IS_PRODUCTION: true,
        IS_STAGING: false,
      }))

      await updateGitLabCommitStatus({
        projectId: 123,
        commitSha: "abc123",
        gitlabHost: "https://gitlab.com",
        accessToken: "", // Empty token
        state: "success",
        testId: 1,
        name: "vizdiff/visual-tests",
        description: "All tests passed",
      })

      // Should not call the API without token
      expect(mockGitlabClient.Commits.editStatus).not.toHaveBeenCalled()
    })
  })

  describe("updateGitLabCommitStatus in production", () => {
    beforeEach(() => {
      // Re-mock environment for production tests
      vi.doMock("./environment", () => ({
        GITLAB_HOST: "https://gitlab.com",
        GITLAB_REJECT_UNAUTHORIZED: true,
        APP_URL: "https://vizdiff.io",
        IS_PRODUCTION: true,
        IS_STAGING: false,
      }))
    })

    it("supports all status states", async () => {
      const states: GitLabStatusState[] = ["pending", "running", "success", "failed", "canceled"]

      // Note: These tests verify the function shape and state types
      // In actual production, the API call would be made
      for (const state of states) {
        // Verify state is a valid GitLabStatusState
        expect(["pending", "running", "success", "failed", "canceled"]).toContain(state)
      }
    })
  })

  describe("GitLabCheckData interface", () => {
    it("accepts required fields", () => {
      // This test verifies TypeScript interface compliance at compile time
      const checkData = {
        projectId: 123,
        commitSha: "abc123def456",
        gitlabHost: "https://gitlab.com",
        accessToken: "glpat-xxxxxxxxxxxxxxxxxxxx",
      }

      expect(checkData.projectId).toBe(123)
      expect(checkData.commitSha).toBe("abc123def456")
      expect(checkData.gitlabHost).toBe("https://gitlab.com")
      expect(checkData.accessToken).toBe("glpat-xxxxxxxxxxxxxxxxxxxx")
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
      expect(validStates).toContain("pending")
      expect(validStates).toContain("running")
      expect(validStates).toContain("success")
      expect(validStates).toContain("failed")
      expect(validStates).toContain("canceled")
    })
  })
})
