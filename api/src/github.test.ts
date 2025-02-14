import { Octokit } from "@octokit/rest"
import type { User } from "shared"
import { GitHubInstallation } from "shared"
import type { DataSource, EntityTarget } from "typeorm"
import { describe, it, vi, expect, beforeEach } from "vitest"

import { Database } from "./database"
import { syncUserInstallations } from "./github"

// Mock external dependencies
vi.mock("@octokit/rest")
vi.mock("./database")
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
const mockInstallationSave = vi.fn()
const mockInstallationFindOne = vi.fn()
const mockInstallationFindOneBy = vi.fn()
const mockDatabaseGetRepository = vi.fn()
const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  andWhere: vi.fn().mockReturnThis(),
  getRawOne: vi.fn().mockResolvedValue({ userId: null }),
}

describe("github", () => {
  // Test fixtures
  const testUser: Partial<User> = {
    id: 1,
    githubId: "123",
    githubUsername: "test-user",
    githubProfile: "{}",
    githubAccessToken: "test-token",
    email: "test@example.com",
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockInstallation = new GitHubInstallation()
  mockInstallation.id = 1
  mockInstallation.installationId = 1
  mockInstallation.accountId = "456"
  mockInstallation.accountName = "test-org"
  mockInstallation.accountType = "Organization"
  mockInstallation.creatorId = 1
  mockInstallation.createdAt = new Date()
  mockInstallation.updatedAt = new Date()

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock implementations
    mockInstallationSave.mockReset()
    mockInstallationFindOne.mockReset()
    mockInstallationFindOneBy.mockReset()
    mockDatabaseGetRepository.mockReset()
    Object.values(mockQueryBuilder).forEach((mock) => mock.mockClear())

    // Setup database mock with repositories and manager
    vi.mocked(Database).mockImplementation(
      async () =>
        ({
          getRepository: mockDatabaseGetRepository.mockImplementation(() => ({
            findOne: mockInstallationFindOne,
            save: mockInstallationSave,
          })),
          manager: {
            findOneBy: mockInstallationFindOneBy,
            save: mockInstallationSave,
            createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
          },
          "@instanceof": Symbol.for("TypeORM.DataSource"),
          name: "default",
          options: { type: "postgres", database: "test" },
          isInitialized: true,
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
    mockInstallationSave.mockImplementation(
      async (
        entity: EntityTarget<GitHubInstallation> | GitHubInstallation,
        installation?: GitHubInstallation,
      ) => {
        if (installation) {
          // Called with (GitHubInstallation, {...})
          return installation
        }
        // Called with just the installation
        if (entity instanceof GitHubInstallation) {
          return entity
        }
        const newInstallation = new GitHubInstallation()
        Object.assign(newInstallation, entity)
        return newInstallation
      },
    )
  })

  describe("syncUserInstallations", () => {
    it("creates new installations", async () => {
      mockInstallationFindOneBy.mockResolvedValue(null)
      mockQueryBuilder.getRawOne.mockResolvedValue({ userId: null })

      const installations = await syncUserInstallations(testUser as User)

      expect(installations).toHaveLength(1)
      expect(mockInstallationSave).toHaveBeenCalled()

      const saveCall = mockInstallationSave.mock.calls[0]
      if (!saveCall) {
        throw new Error("Expected save to be called")
      }
      const [entityType, savedInstallation] = saveCall as [
        EntityTarget<GitHubInstallation>,
        GitHubInstallation,
      ]
      expect(entityType).toBe(GitHubInstallation)
      expect(savedInstallation).toMatchObject({
        installationId: 1,
        accountId: "456",
        accountName: "test-org",
        accountType: "Organization",
        creatorId: testUser.id,
      })
    })

    it("updates existing installations", async () => {
      // Create a mock installation with different data than what GitHub returns
      const existingInstallation = new GitHubInstallation()
      existingInstallation.id = 1
      existingInstallation.installationId = 1
      existingInstallation.accountId = "789" // Different account ID
      existingInstallation.accountName = "old-org" // Different org name
      existingInstallation.accountType = "Organization"
      existingInstallation.creatorId = 1
      existingInstallation.createdAt = new Date()
      existingInstallation.updatedAt = new Date()

      mockInstallationFindOneBy.mockResolvedValue(existingInstallation)
      mockQueryBuilder.getRawOne.mockResolvedValue({ userId: testUser.id })

      const installations = await syncUserInstallations(testUser as User)

      expect(installations).toHaveLength(1)
      expect(mockInstallationSave).toHaveBeenCalled()

      const saveCall = mockInstallationSave.mock.calls[0]
      if (!saveCall) {
        throw new Error("Expected save to be called")
      }
      const [entityType, savedInstallation] = saveCall as [
        EntityTarget<GitHubInstallation>,
        GitHubInstallation,
      ]
      expect(entityType).toBe(GitHubInstallation)
      expect(savedInstallation).toMatchObject({
        installationId: 1,
        accountId: "456", // Updated to match GitHub data
        accountName: "test-org", // Updated to match GitHub data
        accountType: "Organization",
      })
    })

    it("skips update when installation data hasn't changed", async () => {
      // Create a mock installation with the same data as GitHub returns
      const existingInstallation = new GitHubInstallation()
      existingInstallation.id = 1
      existingInstallation.installationId = 1
      existingInstallation.accountId = "456" // Same as GitHub data
      existingInstallation.accountName = "test-org" // Same as GitHub data
      existingInstallation.accountType = "Organization"
      existingInstallation.creatorId = 1
      existingInstallation.createdAt = new Date()
      existingInstallation.updatedAt = new Date()

      mockInstallationFindOneBy.mockResolvedValue(existingInstallation)
      mockQueryBuilder.getRawOne.mockResolvedValue({ userId: testUser.id })

      const installations = await syncUserInstallations(testUser as User)

      expect(installations).toHaveLength(1)
      expect(mockInstallationSave).not.toHaveBeenCalled()
      expect(installations[0]).toBe(existingInstallation)
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

      const installations = await syncUserInstallations(testUser as User)

      expect(installations).toHaveLength(0)
      expect(mockInstallationSave).not.toHaveBeenCalled()
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

      await expect(syncUserInstallations(testUser as User)).rejects.toThrow("GitHub API error")
    })
  })
})
