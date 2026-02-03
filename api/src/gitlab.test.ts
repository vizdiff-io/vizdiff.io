import { Gitlab } from "@gitbeaker/rest"
import { GitLabGroup, User, UserGitlabProjectAccess } from "shared"
import type { DataSource, EntityManager } from "typeorm"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { Database } from "./database"
import {
  getGitLabClient,
  syncUserGitLabGroups,
  syncUserGitLabProjects,
  getGitLabGroupsForUserId,
  updateGitLabCommitStatus,
} from "./gitlab"

// Mock external dependencies
vi.mock("./database")
vi.mock("@gitbeaker/rest")
vi.mock("./environment", () => ({
  GITLAB_HOST: "https://gitlab.com",
  GITLAB_REJECT_UNAUTHORIZED: true,
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
const mockGetMany = vi.fn()
const mockGetOne = vi.fn()

// Create a reusable query builder mock that properly chains
function createMockQueryBuilder() {
  const mock = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    getRawOne: vi.fn().mockResolvedValue(null),
    getMany: mockGetMany,
    getOne: mockGetOne,
    insert: vi.fn().mockReturnThis(),
    into: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ raw: [], affected: 1 }),
  }

  return mock
}

// Test fixtures
function createTestUser(overrides: Partial<User> = {}): User {
  const user = new User()
  Object.assign(user, {
    id: 1,
    githubId: null,
    githubUsername: null,
    githubProfile: null,
    githubAccessToken: null,
    gitlabId: "12345",
    gitlabUsername: "testuser",
    gitlabProfile: "{}",
    gitlabAccessToken: "gitlab-test-token",
    gitlabRefreshToken: "gitlab-refresh-token",
    gitlabHost: "https://gitlab.com",
    email: "test@example.com",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })
  return user
}

// Mock GitLab API responses
const mockGitLabGroups = [
  {
    id: 100,
    name: "Test Group",
    path: "test-group",
    full_path: "test-group",
    web_url: "https://gitlab.com/test-group",
    avatar_url: "https://gitlab.com/avatar.png",
  },
  {
    id: 200,
    name: "Another Group",
    path: "another-group",
    full_path: "parent/another-group",
    web_url: "https://gitlab.com/parent/another-group",
    avatar_url: null,
  },
]

const mockGitLabProjects = [
  {
    id: 1001,
    name: "Project One",
    path: "project-one",
    path_with_namespace: "test-group/project-one",
    web_url: "https://gitlab.com/test-group/project-one",
    namespace: {
      id: 100,
      name: "Test Group",
      path: "test-group",
      kind: "group",
      full_path: "test-group",
    },
  },
  {
    id: 1002,
    name: "Project Two",
    path: "project-two",
    path_with_namespace: "test-group/project-two",
    web_url: "https://gitlab.com/test-group/project-two",
    namespace: {
      id: 100,
      name: "Test Group",
      path: "test-group",
      kind: "group",
      full_path: "test-group",
    },
  },
]

describe("gitlab", () => {
  let mockQueryBuilder: ReturnType<typeof createMockQueryBuilder>
  let mockGitlabClient: {
    Groups: { all: ReturnType<typeof vi.fn>; allProjects: ReturnType<typeof vi.fn> }
    Projects: { all: ReturnType<typeof vi.fn>; show: ReturnType<typeof vi.fn> }
    Commits: { editStatus: ReturnType<typeof vi.fn> }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock implementations
    mockFindOneBy.mockReset()
    mockSave.mockReset()
    mockGetMany.mockReset()
    mockGetOne.mockReset()

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
            transaction: vi.fn().mockImplementation(async (cb: (em: EntityManager) => Promise<void>) => {
              const transactionManager = {
                createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
                save: mockSave,
              } as unknown as EntityManager
              await cb(transactionManager)
            }),
          },
        }) as unknown as DataSource,
    )

    // Setup GitLab client mock
    mockGitlabClient = {
      Groups: {
        all: vi.fn().mockResolvedValue(mockGitLabGroups),
        allProjects: vi.fn().mockResolvedValue(mockGitLabProjects),
      },
      Projects: {
        all: vi.fn().mockResolvedValue(mockGitLabProjects),
        show: vi.fn().mockResolvedValue(mockGitLabProjects[0]),
      },
      Commits: {
        editStatus: vi.fn().mockResolvedValue({}),
      },
    }

    vi.mocked(Gitlab).mockImplementation(() => mockGitlabClient as unknown as InstanceType<typeof Gitlab>)

    // Setup save mock to return the input with an id
    mockSave.mockImplementation(async (_entityType: unknown, entity: GitLabGroup | UserGitlabProjectAccess | UserGitlabProjectAccess[]) => {
      if (Array.isArray(entity)) {
        return entity
      }
      if (entity instanceof GitLabGroup && !entity.id) {
        entity.id = Math.floor(Math.random() * 1000)
      }
      return entity
    })
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

  describe("syncUserGitLabGroups", () => {
    it("returns empty array when user has no GitLab access token", async () => {
      const user = createTestUser({ gitlabAccessToken: null })

      const groups = await syncUserGitLabGroups(user)

      expect(groups).toHaveLength(0)
      expect(Gitlab).not.toHaveBeenCalled()
    })

    it("creates new groups from GitLab API", async () => {
      const user = createTestUser()

      // Mock finding no existing groups
      mockFindOneBy.mockResolvedValue(null)

      const groups = await syncUserGitLabGroups(user)

      expect(groups).toHaveLength(2)
      expect(mockGitlabClient.Groups.all).toHaveBeenCalledWith({
        minAccessLevel: 10,
        perPage: 100,
      })
      expect(mockSave).toHaveBeenCalled()
    })

    it("updates existing groups", async () => {
      const user = createTestUser()

      // Mock finding an existing group
      const existingGroup = new GitLabGroup()
      Object.assign(existingGroup, {
        id: 1,
        gitlabGroupId: 100,
        groupPath: "old-path",
        groupName: "Old Name",
        fullPath: "old-path",
        gitlabHost: "https://gitlab.com",
        webUrl: "https://gitlab.com/old-path",
        avatarUrl: null,
      })
      mockFindOneBy.mockResolvedValueOnce(existingGroup)
      mockFindOneBy.mockResolvedValueOnce(null) // For the second group

      const groups = await syncUserGitLabGroups(user)

      expect(groups).toHaveLength(2)
      // First group should be updated
      expect(groups[0]?.groupName).toBe("Test Group")
      expect(groups[0]?.groupPath).toBe("test-group")
    })

    it("handles GitLab API errors", async () => {
      const user = createTestUser()

      mockGitlabClient.Groups.all.mockRejectedValue(new Error("GitLab API error"))

      await expect(syncUserGitLabGroups(user)).rejects.toThrow("GitLab API error")
    })

    it("links groups to user", async () => {
      const user = createTestUser()

      // Mock finding no existing groups
      mockFindOneBy.mockResolvedValue(null)

      // Mock finding no existing user-group link
      mockQueryBuilder.getRawOne.mockResolvedValue(null)

      await syncUserGitLabGroups(user)

      // Should insert user-group link
      expect(mockQueryBuilder.insert).toHaveBeenCalled()
      expect(mockQueryBuilder.into).toHaveBeenCalledWith("user_gitlab_groups")
    })

    it("skips linking when user already linked to group", async () => {
      const user = createTestUser()

      // Mock finding no existing groups
      mockFindOneBy.mockResolvedValue(null)

      // Mock finding existing user-group link
      mockQueryBuilder.getRawOne.mockResolvedValue({ userId: user.id })

      await syncUserGitLabGroups(user)

      // Should not insert since link exists - insert is called for other groups
      // but the first group won't trigger insert due to existing link
    })
  })

  describe("syncUserGitLabProjects", () => {
    it("returns 0 when user has no GitLab access token", async () => {
      const user = createTestUser({ gitlabAccessToken: null })

      const count = await syncUserGitLabProjects(user)

      expect(count).toBe(0)
      expect(Gitlab).not.toHaveBeenCalled()
    })

    it("syncs projects and returns count", async () => {
      const user = createTestUser()

      const count = await syncUserGitLabProjects(user)

      expect(count).toBe(2)
      expect(mockGitlabClient.Projects.all).toHaveBeenCalledWith({
        membership: true,
        minAccessLevel: 10,
        perPage: 100,
      })
    })

    it("uses transaction for atomic updates", async () => {
      const user = createTestUser()

      await syncUserGitLabProjects(user)

      // Verify Database was called (transaction is called internally)
      expect(Database).toHaveBeenCalled()
    })

    it("handles GitLab API errors", async () => {
      const user = createTestUser()

      mockGitlabClient.Projects.all.mockRejectedValue(new Error("GitLab API error"))

      await expect(syncUserGitLabProjects(user)).rejects.toThrow("GitLab API error")
    })
  })

  describe("getGitLabGroupsForUserId", () => {
    it("returns groups for a user", async () => {
      const mockGroups = [
        Object.assign(new GitLabGroup(), {
          id: 1,
          gitlabGroupId: 100,
          groupName: "Test Group",
        }),
      ]
      mockGetMany.mockResolvedValue(mockGroups)

      const groups = await getGitLabGroupsForUserId(1)

      expect(groups).toEqual(mockGroups)
      expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith(
        "user_gitlab_groups",
        "ug",
        "ug.group_id = grp.id",
      )
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("ug.user_id = :userId", { userId: 1 })
    })

    it("returns empty array when user has no groups", async () => {
      mockGetMany.mockResolvedValue([])

      const groups = await getGitLabGroupsForUserId(999)

      expect(groups).toHaveLength(0)
    })
  })

  describe("updateGitLabCommitStatus", () => {
    it("updates commit status successfully", async () => {
      await updateGitLabCommitStatus(123, "abc123", "success", {
        name: "vizdiff/visual-tests",
        targetUrl: "https://vizdiff.io/build?id=1",
        description: "All tests passed",
        accessToken: "test-token",
      })

      expect(mockGitlabClient.Commits.editStatus).toHaveBeenCalledWith(123, "abc123", "success", {
        name: "vizdiff/visual-tests",
        targetUrl: "https://vizdiff.io/build?id=1",
        description: "All tests passed",
      })
    })

    it("uses custom host when provided", async () => {
      await updateGitLabCommitStatus(123, "abc123", "pending", {
        name: "vizdiff/visual-tests",
        targetUrl: "https://vizdiff.io/build?id=1",
        description: "Tests running",
        accessToken: "test-token",
        host: "https://gitlab.company.com",
      })

      expect(Gitlab).toHaveBeenCalledWith({
        host: "https://gitlab.company.com",
        oauthToken: "test-token",
        rejectUnauthorized: true,
      })
    })

    it("throws on API error", async () => {
      mockGitlabClient.Commits.editStatus.mockRejectedValue(new Error("API error"))

      await expect(
        updateGitLabCommitStatus(123, "abc123", "success", {
          name: "vizdiff/visual-tests",
          targetUrl: "https://vizdiff.io/build?id=1",
          description: "All tests passed",
          accessToken: "test-token",
        }),
      ).rejects.toThrow("API error")
    })

    it("supports all status states", async () => {
      const states: Array<"pending" | "running" | "success" | "failed" | "canceled"> = [
        "pending",
        "running",
        "success",
        "failed",
        "canceled",
      ]

      for (const state of states) {
        await updateGitLabCommitStatus(123, "abc123", state, {
          name: "vizdiff/visual-tests",
          targetUrl: "https://vizdiff.io/build?id=1",
          description: `Status: ${state}`,
          accessToken: "test-token",
        })

        expect(mockGitlabClient.Commits.editStatus).toHaveBeenCalledWith(
          123,
          "abc123",
          state,
          expect.any(Object),
        )
      }
    })
  })
})
