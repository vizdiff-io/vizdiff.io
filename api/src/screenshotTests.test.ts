import { Project, ScreenshotTest, User } from "shared"
import type { DataSource, EntityManager } from "typeorm"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { Database } from "./database"
import { createScreenshotTest } from "./screenshotTests"

// Mock external dependencies
vi.mock("./database")

// Mock function declarations
const mockSave = vi.fn()
const mockFindOne = vi.fn()
const mockDelete = vi.fn()
const mockTransaction = vi.fn()

// Create a reusable query builder mock that properly chains
function createMockQueryBuilder() {
  const mock = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    andWhere: vi.fn(),
    getRawOne: vi.fn(),
  }

  // Make all methods chainable
  mock.select.mockReturnValue(mock)
  mock.from.mockReturnValue(mock)
  mock.where.mockReturnValue(mock)
  mock.andWhere.mockReturnValue(mock)

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

const testProject = new Project()
Object.assign(testProject, {
  id: 1,
  name: "Test Project",
  token: "test-token",
  githubRepoUrl: "https://github.com/test/test",
  user: testUser,
  createdAt: new Date(),
  updatedAt: new Date(),
})

// Create a complete ScreenshotTest fixture with all fields
const createCompleteScreenshotTest = (overrides = {}) => {
  const test = new ScreenshotTest()
  Object.assign(test, {
    id: 1,
    project: testProject,
    buildNumber: 1,
    buildDurationSec: 120.5,
    commitSha: "1234567890123456789012345678901234567890",
    branch: "main",
    baseCommitSha: "0234567890123456789012345678901234567890",
    baseBranch: "develop",
    prNumber: 123,
    uploadId: "test-upload-id",
    status: "pending",
    githubCheckRunId: 987654321,
    tag: "Infrastructure upgrade",
    totalChanges: 42,
    browserVersion: "chrome-linux-135.0.7049.52",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })
  return test
}

describe("screenshotTests", () => {
  let mockQueryBuilder: ReturnType<typeof createMockQueryBuilder>

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock implementations
    mockSave.mockReset()
    mockFindOne.mockReset()
    mockDelete.mockReset()
    mockTransaction.mockReset()

    // Create a fresh query builder mock for each test
    mockQueryBuilder = createMockQueryBuilder()

    // Setup database mock
    vi.mocked(Database).mockImplementation(
      async () =>
        ({
          manager: {
            save: mockSave,
            findOne: mockFindOne,
            delete: mockDelete,
            createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
          },
          transaction: mockTransaction,
        }) as unknown as DataSource,
    )

    // Default transaction implementation that executes the callback
    mockTransaction.mockImplementation(async (cb: (manager: EntityManager) => Promise<unknown>) => {
      const mockManager = {
        save: mockSave,
        createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
      } as unknown as EntityManager
      return await cb(mockManager)
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("createScreenshotTest", () => {
    it("creates a screenshot test with all fields", async () => {
      // Mock finding no existing build number
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({ maxBuildNumber: 0 })

      // Mock saving the screenshot test with all fields
      const expectedTest = createCompleteScreenshotTest()
      mockSave.mockResolvedValueOnce(expectedTest)

      const screenshotTest = await createScreenshotTest({
        project: testProject,
        commitSha: "1234567890123456789012345678901234567890",
        branch: "main",
        uploadId: "test-upload-id",
        baseCommitSha: "0234567890123456789012345678901234567890",
        baseBranch: "develop",
        prNumber: 123,
        githubCheckRunId: 987654321,
      })

      expect(screenshotTest).toBeDefined()
      expect(screenshotTest.buildNumber).toBe(1)
      expect(screenshotTest.buildDurationSec).toBe(120.5)
      expect(screenshotTest.status).toBe("pending")
      expect(screenshotTest.baseCommitSha).toBe("0234567890123456789012345678901234567890")
      expect(screenshotTest.baseBranch).toBe("develop")
      expect(screenshotTest.prNumber).toBe(123)
      expect(screenshotTest.tag).toBe("Infrastructure upgrade")
      expect(screenshotTest.totalChanges).toBe(42)
      expect(screenshotTest.browserVersion).toBe("chrome-linux-135.0.7049.52")
      expect(screenshotTest.githubCheckRunId).toBe(987654321)

      expect(mockTransaction).toHaveBeenCalled()
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        "COALESCE(MAX(build_number), 0)",
        "maxBuildNumber",
      )
      expect(mockQueryBuilder.from).toHaveBeenCalledWith(ScreenshotTest, "st")
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("project_id = :projectId", {
        projectId: testProject.id,
      })
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          project: testProject,
          commitSha: "1234567890123456789012345678901234567890",
          branch: "main",
          uploadId: "test-upload-id",
          baseCommitSha: "0234567890123456789012345678901234567890",
          baseBranch: "develop",
          prNumber: 123,
          githubCheckRunId: 987654321,
        }),
      )
    })

    it("creates a screenshot test with minimal required fields", async () => {
      // Mock finding no existing build number
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({ maxBuildNumber: 0 })

      // Mock saving the screenshot test with minimal fields
      const minimalTest = createCompleteScreenshotTest({
        baseCommitSha: null,
        baseBranch: null,
        prNumber: null,
        tag: null,
        totalChanges: null,
        browserVersion: null,
        githubCheckRunId: null,
        buildDurationSec: null,
      })
      mockSave.mockResolvedValueOnce(minimalTest)

      const screenshotTest = await createScreenshotTest({
        project: testProject,
        commitSha: "1234567890123456789012345678901234567890",
        branch: "main",
        uploadId: "test-upload-id",
      })

      expect(screenshotTest).toBeDefined()
      expect(screenshotTest.buildNumber).toBe(1)
      expect(screenshotTest.buildDurationSec).toBeNull()
      expect(screenshotTest.status).toBe("pending")
      expect(screenshotTest.baseCommitSha).toBeNull()
      expect(screenshotTest.baseBranch).toBeNull()
      expect(screenshotTest.prNumber).toBeNull()
      expect(screenshotTest.tag).toBeNull()
      expect(screenshotTest.totalChanges).toBeNull()
      expect(screenshotTest.browserVersion).toBeNull()
      expect(screenshotTest.githubCheckRunId).toBeNull()
    })

    it("increments build number correctly", async () => {
      // Mock finding existing build number
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({ maxBuildNumber: 5 })

      // Mock saving the screenshot test
      const expectedTest = createCompleteScreenshotTest({ buildNumber: 6 })
      mockSave.mockResolvedValueOnce(expectedTest)

      const screenshotTest = await createScreenshotTest({
        project: testProject,
        commitSha: "2234567890123456789012345678901234567890",
        branch: "feature",
        uploadId: "test-upload-id-2",
      })

      expect(screenshotTest.buildNumber).toBe(6)
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        "COALESCE(MAX(build_number), 0)",
        "maxBuildNumber",
      )
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          buildNumber: 6,
          project: testProject,
        }),
      )
    })

    it("enforces required parameters", async () => {
      await expect(
        createScreenshotTest({
          project: testProject,
          commitSha: "", // Empty commit SHA
          branch: "main",
          uploadId: "test-upload-id",
        }),
      ).rejects.toThrow("Missing required parameters")

      await expect(
        createScreenshotTest({
          project: testProject,
          commitSha: "1234567890123456789012345678901234567890",
          branch: "", // Empty branch
          uploadId: "test-upload-id",
        }),
      ).rejects.toThrow("Missing required parameters")

      await expect(
        createScreenshotTest({
          project: testProject,
          commitSha: "1234567890123456789012345678901234567890",
          branch: "main",
          uploadId: "", // Empty upload ID
        }),
      ).rejects.toThrow("Missing required parameters")

      expect(mockTransaction).not.toHaveBeenCalled()
      expect(mockSave).not.toHaveBeenCalled()
    })

    it("handles transaction errors", async () => {
      // Mock transaction failure
      mockTransaction.mockRejectedValueOnce(new Error("Transaction failed"))

      await expect(
        createScreenshotTest({
          project: testProject,
          commitSha: "1234567890123456789012345678901234567890",
          branch: "main",
          uploadId: "test-upload-id",
        }),
      ).rejects.toThrow("Transaction failed")

      expect(mockTransaction).toHaveBeenCalled()
      expect(mockSave).not.toHaveBeenCalled()
    })
  })
})
