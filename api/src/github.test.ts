import { Octokit } from "@octokit/rest"
import { GitHubInstallation, User } from "shared"
import type { DataSource } from "typeorm"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { Database } from "./database"
import { syncUserInstallations } from "./github"

// Mock external dependencies
vi.mock("./database")
vi.mock("@octokit/rest")
vi.mock("./environment", () => ({
  GITHUB_APP_ID: "123456",
  IS_TEST: true,
  IS_PRODUCTION: false,
  POSTGRES_HOST: "localhost",
  POSTGRES_PORT: 5432,
  POSTGRES_USER: "test",
  POSTGRES_PASS: "test",
  POSTGRES_DATABASE: "test",
}))

// Mock function declarations
const mockFindOneBy = vi.fn()
const mockSave = vi.fn()

// Create a reusable query builder mock that properly chains
function createMockQueryBuilder() {
  const mock = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getRawOne: vi.fn().mockResolvedValue({ userId: null }),
    insert: vi.fn().mockReturnThis(),
    into: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ raw: [], affected: 1 }),
  }

  return mock
}

// Test fixtures
const testUser = new User()
Object.assign(testUser, {
  id: 1,
  githubId: "12345",
  githubUsername: "testuser",
  githubProfile: "{}",
  githubAccessToken: "test-token",
  email: "test@example.com",
  createdAt: new Date(),
  updatedAt: new Date(),
})

describe("github", () => {
  let mockQueryBuilder: ReturnType<typeof createMockQueryBuilder>

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock implementations
    mockFindOneBy.mockReset()
    mockSave.mockReset()

    // Create a fresh query builder mock for each test
    mockQueryBuilder = createMockQueryBuilder()

    // Setup database mock
    vi.mocked(Database).mockImplementation(
      async () =>
        ({
          manager: {
            findOneBy: mockFindOneBy,
            createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
            save: mockSave,
          },
        }) as unknown as DataSource,
    )

    // Setup Octokit mock with app installations
    vi.mocked(Octokit).mockImplementation(
      () =>
        ({
          apps: {
            listInstallationsForAuthenticatedUser: vi.fn().mockResolvedValue({
              data: {
                installations: [
                  {
                    id: 1,
                    account: { id: 456, login: "test-org", type: "Organization" },
                    app_id: 123456,
                  },
                ],
              },
            }),
          },
        }) as unknown as Octokit,
    )

    // Setup save mock to return the input
    mockSave.mockImplementation(
      async (_entityType: typeof GitHubInstallation, installation: GitHubInstallation) => {
        return installation
      },
    )
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("syncUserInstallations", () => {
    it("creates new installations", async () => {
      // Mock finding no existing installation
      mockFindOneBy.mockResolvedValueOnce(null)

      // Mock finding the newly created installation
      const expectedInstallation = new GitHubInstallation()
      Object.assign(expectedInstallation, {
        id: 1,
        installationId: 1,
        accountId: "456",
        accountName: "test-org",
        accountType: "Organization",
        creatorId: testUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      mockFindOneBy.mockResolvedValueOnce(expectedInstallation)

      // Mock finding no existing user-installation link
      mockQueryBuilder.getRawOne.mockResolvedValueOnce(null)

      const installations = await syncUserInstallations(testUser)

      expect(installations).toHaveLength(1)
      expect(installations[0]).toBe(expectedInstallation)
      expect(installations[0]?.accountId).toBe("456")
      expect(installations[0]?.accountName).toBe("test-org")
    })

    it("updates existing installations", async () => {
      // Create a mock installation with different data than what GitHub returns
      const existingInstallation = new GitHubInstallation()
      Object.assign(existingInstallation, {
        id: 1,
        installationId: 1,
        accountId: "789", // Different account ID
        accountName: "old-org", // Different org name
        accountType: "Organization",
        creatorId: testUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Mock finding the existing installation
      mockFindOneBy.mockResolvedValueOnce(existingInstallation)

      // Mock finding no existing user-installation link
      mockQueryBuilder.getRawOne.mockResolvedValueOnce(null)

      const installations = await syncUserInstallations(testUser)

      expect(installations).toHaveLength(1)
      expect(installations[0]).toBe(existingInstallation)
      expect(installations[0]?.accountId).toBe("456")
      expect(installations[0]?.accountName).toBe("test-org")
      expect(mockSave).toHaveBeenCalledWith(GitHubInstallation, existingInstallation)
    })

    it("skips update when installation data hasn't changed", async () => {
      // Create a mock installation with the same data as GitHub returns
      const existingInstallation = new GitHubInstallation()
      Object.assign(existingInstallation, {
        id: 1,
        installationId: 1,
        accountId: "456", // Same as GitHub data
        accountName: "test-org", // Same as GitHub data
        accountType: "Organization",
        creatorId: testUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Mock finding the existing installation
      mockFindOneBy.mockResolvedValueOnce(existingInstallation)

      // Mock finding no existing user-installation link
      mockQueryBuilder.getRawOne.mockResolvedValueOnce(null)

      const installations = await syncUserInstallations(testUser)

      expect(installations).toHaveLength(1)
      expect(installations[0]).toBe(existingInstallation)
      expect(mockSave).not.toHaveBeenCalled()
    })

    it("filters out other app installations", async () => {
      // Override Octokit mock for this test to return a different app_id
      vi.mocked(Octokit).mockImplementation(
        () =>
          ({
            apps: {
              listInstallationsForAuthenticatedUser: vi.fn().mockResolvedValue({
                data: {
                  installations: [
                    {
                      id: 1,
                      account: { id: 456, login: "test-org", type: "Organization" },
                      app_id: 999999, // Different app ID
                    },
                  ],
                },
              }),
            },
          }) as unknown as Octokit,
      )

      const installations = await syncUserInstallations(testUser)

      expect(installations).toHaveLength(0)
      expect(mockSave).not.toHaveBeenCalled()
    })

    it("handles GitHub API errors gracefully", async () => {
      vi.mocked(Octokit).mockImplementation(
        () =>
          ({
            apps: {
              listInstallationsForAuthenticatedUser: vi
                .fn()
                .mockRejectedValue(new Error("GitHub API error")),
            },
          }) as unknown as Octokit,
      )

      await expect(syncUserInstallations(testUser)).rejects.toThrow("GitHub API error")
    })
  })
})
