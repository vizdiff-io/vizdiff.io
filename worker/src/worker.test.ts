/**
 * This test suite verifies the worker service that processes Storybook builds.
 * The worker:
 * 1. Downloads a tarball from S3
 * 2. Extracts it locally
 * 3. Starts an HTTP server to serve the files
 * 4. Uses WebdriverIO to take screenshots
 * 5. Compares screenshots with baseline images
 * 6. Saves results to the database
 *
 * Because this involves many external services, we mock:
 * - S3 for tarball storage
 * - File system operations
 * - Database operations (TypeORM)
 * - WebdriverIO for browser control
 * - HTTP server for serving files
 * - PostgreSQL notification system
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
// These eslint-disable directives are used because we're mocking complex database types for testing

import "reflect-metadata"
import { S3Client, GetObjectCommand, type S3ClientResolvedConfig } from "@aws-sdk/client-s3"
import type { MiddlewareStack } from "@aws-sdk/types"
import fs, { type PathLike, type WriteStream } from "node:fs"
import type { FileHandle } from "node:fs/promises"
import { TestResult, ScreenshotTest } from "shared"
import { Readable } from "stream"
import type { DataSourceOptions, Repository, DataSource } from "typeorm"
import { expect, describe, it, afterAll, beforeEach, vi, afterEach } from "vitest"

import { Database } from "./database"
import { log } from "./log"
import { ingestStorybook, processTask, shutdown, sweepStuckBuilds } from "./worker"

// Mock function declarations - these track calls to key operations
const mockSend = vi.fn()
const mockScreenshotTestSave = vi.fn()
const mockTestResultSave = vi.fn()

// Test fixtures - reusable mock data
const mockStories = {
  story1: {
    id: "story1",
    name: "Story 1",
    importPath: "./stories/Story1.stories.tsx",
  },
}

// Mock S3 client and commands
vi.mock("@aws-sdk/client-s3", () => {
  class MockGetObjectCommand {
    constructor(public input: { Bucket: string; Key: string }) {}
  }
  Object.defineProperty(MockGetObjectCommand, Symbol.hasInstance, {
    value: (instance: unknown) => instance?.constructor === MockGetObjectCommand,
  })

  return {
    S3Client: vi.fn(() => ({ send: mockSend })),
    GetObjectCommand: Object.assign(
      vi.fn((input: { Bucket: string; Key: string }) => new MockGetObjectCommand(input)),
      { prototype: MockGetObjectCommand.prototype },
    ),
  }
})

// Prevent the worker from starting its polling loop
vi.mock("./worker", async (importOriginal) => {
  const actual: object = await importOriginal()
  return {
    ...actual,
    main: vi.fn(),
    pollForNewTasks: vi.fn(),
  }
})

// Mock database connection
vi.mock("./database", () => ({
  Database: vi.fn(),
}))

// Mock WebdriverIO browser automation
vi.mock("webdriverio", () => ({
  remote: vi.fn().mockImplementation(async () => {
    log.debug("WebdriverIO remote called")
    let storyStoreReady = false
    return {
      url: vi.fn().mockImplementation(async (url: string) => {
        log.debug("WebdriverIO url called with:", url)
      }),
      saveScreenshot: vi.fn().mockImplementation(async () => {
        log.debug("WebdriverIO saveScreenshot called")
        return Buffer.from("mock screenshot")
      }),
      execute: vi.fn().mockImplementation(async (fn?: () => unknown) => {
        log.debug("WebdriverIO execute called", { hasFunction: !!fn })
        // If a function is passed, this is the storyStore check
        if (fn) {
          if (!storyStoreReady) {
            storyStoreReady = true
            return true
          }
          return mockStories
        }
        // Otherwise this is the story extraction
        return mockStories
      }),
      waitUntil: vi.fn().mockImplementation(async (fn: () => Promise<unknown>) => {
        log.debug("WebdriverIO waitUntil called")
        await fn()
        return true
      }),
      deleteSession: vi.fn().mockImplementation(async () => {
        log.debug("WebdriverIO deleteSession called")
      }),
      capabilities: {
        browserName: "chrome",
        browserVersion: "latest",
        platformName: "linux",
      },
    }
  }),
}))

// Mock tar extraction
vi.mock("tar", () => ({
  extract: vi.fn().mockImplementation(async () => {
    log.debug("tar extract called")
    return undefined
  }),
}))

// Mock story processing module
vi.mock("./stories", () => ({
  processStory: vi
    .fn()
    .mockImplementation(
      async ({
        story,
        testResultTable,
        uploadId,
      }: {
        story: { id: string; name: string }
        testResultTable: Repository<TestResult>
        uploadId: string
      }) => {
        log.debug("processStory called with story:", story)
        const result = {
          id: 1,
          name: story.name,
          storyId: story.id,
          screenshotTestId: 123,
          changeStatus: "new",
          baselineImageUrl: "mock-baseline-url",
          newImageUrl: `mock-new-url-${uploadId}`,
          diffImageUrl: "mock-diff-url",
          diffRatio: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        log.debug("processStory returning:", result)
        await testResultTable.save(result)
        return result
      },
    ),
}))

// Mock HTTP server for serving Storybook files
vi.mock("node:http", () => {
  const mockServer = {
    listen: vi.fn().mockImplementation((_port, callback?: () => void) => {
      log.debug("HTTP server started")
      if (callback) {
        callback()
      }
      return mockServer
    }),
    address: vi.fn().mockReturnValue({ port: 12345 }),
    close: vi.fn().mockImplementation((callback?: () => void) => {
      log.debug("HTTP server closed")
      if (callback) {
        callback()
      }
    }),
    once: vi.fn().mockImplementation((event: string, callback: () => void) => {
      if (event === "listening") {
        callback()
      }
      return mockServer
    }),
  }

  return {
    default: { createServer: vi.fn().mockReturnValue(mockServer) },
    createServer: vi.fn().mockReturnValue(mockServer),
  }
})

// Mock PostgreSQL notification system
vi.mock("pg-listen", () => ({
  default: vi.fn().mockImplementation(() => ({
    notifications: { on: vi.fn() },
    events: { on: vi.fn() },
    connect: vi.fn(),
    listenTo: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}))

// Mock PostgreSQL connection pool
vi.mock("pg", () => {
  const mockPool = vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    }),
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    end: vi.fn().mockResolvedValue(undefined),
  }))

  return {
    __esModule: true,
    Pool: mockPool,
    default: { Pool: mockPool },
  }
})

describe("worker", () => {
  // Test fixtures - reusable mock data
  const mockScreenshotTest = {
    id: 123,
    status: "pending",
    baseCommitSha: "abc123",
    createdAt: new Date(),
    uploadId: "test-upload",
  }
  const mockBaseTestResult = {
    id: 456,
    storyId: "story1",
    screenshotTest: {
      id: 123,
      uploadId: "base-upload",
    },
    changeStatus: "unchanged",
  }

  beforeEach(() => {
    // Reset all mocks before each test
    mockSend.mockReset()
    mockScreenshotTestSave.mockReset()
    mockTestResultSave.mockReset()

    // Setup S3 mock to return appropriate content based on the key
    mockSend.mockImplementation(async (command: { input: { Key?: string } }) => {
      const key = command.input.Key
      if (!key) {
        throw new Error("Missing key in S3 command")
      }

      if (key.includes(".tar.gz")) {
        return { Body: Readable.from([Buffer.from("mock tarball content")]) }
      }
      if (key.includes("screenshots")) {
        return { Body: Readable.from([Buffer.from("mock baseline image")]) }
      }
      throw new Error(`Unexpected S3 key: ${key}`)
    })

    // Setup database mock with repositories
    vi.mocked(Database).mockImplementation(
      async () =>
        ({
          getRepository: vi.fn().mockImplementation((entity) => {
            if (entity === ScreenshotTest) {
              return {
                findOneBy: vi.fn().mockResolvedValue(mockScreenshotTest),
                save: mockScreenshotTestSave.mockImplementation(async (test: unknown) => test),
              } as unknown as Repository<ScreenshotTest>
            }
            return {
              createQueryBuilder: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                getMany: vi.fn().mockResolvedValue([mockBaseTestResult]),
              }),
              save: mockTestResultSave.mockImplementation(async (result: unknown) => result),
            } as unknown as Repository<TestResult>
          }),
          "@instanceof": Symbol.for("TypeORM.DataSource"),
          name: "default",
          options: { type: "postgres", database: "test" } as DataSourceOptions,
          isInitialized: true,
        }) as unknown as DataSource,
    )

    // Setup file system mocks
    const writeStream = createMockWriteStream()
    vi.spyOn(fs, "createWriteStream").mockReturnValue(writeStream)
    vi.spyOn(fs.promises, "readFile").mockImplementation(async (path: PathLike | FileHandle) => {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      if (path.toString().endsWith("iframe.html")) {
        return `window['STORIES'] = ${JSON.stringify(mockStories)};`
      }
      return Buffer.from("mock file content")
    })
    vi.spyOn(fs.promises, "rm").mockResolvedValue(undefined)
    vi.spyOn(fs.promises, "mkdir").mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  afterAll(() => {
    shutdown()
  })

  // Helper function to create a mock write stream
  function createMockWriteStream(): WriteStream {
    const callbacks = new Map<string, Array<() => void>>()
    const writeStream = {
      on: vi.fn().mockImplementation((event: string, callback: () => void) => {
        const handlers = callbacks.get(event) ?? []
        handlers.push(callback)
        callbacks.set(event, handlers)
        if (event === "finish") {
          callback()
        }
        return writeStream
      }),
      once: vi.fn().mockImplementation((event: string, callback: () => void) => {
        if (event === "finish") {
          callback()
        }
        return writeStream
      }),
      removeListener: vi.fn().mockReturnThis(),
      addListener: vi.fn().mockReturnThis(),
      prependListener: vi.fn().mockReturnThis(),
      prependOnceListener: vi.fn().mockReturnThis(),
      removeAllListeners: vi.fn().mockReturnThis(),
      pipe: vi.fn().mockReturnThis(),
      close: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      emit: vi.fn().mockImplementation((event: string) => {
        const handlers = callbacks.get(event) ?? []
        handlers.forEach((handler) => handler())
        return true
      }),
      bytesWritten: 0,
      path: "",
      pending: false,
      writable: true,
      destroy: vi.fn(),
    } as unknown as WriteStream
    return writeStream
  }

  describe("processTask", () => {
    it("should fail to process an unknown task", async () => {
      let error: Error | undefined
      try {
        await processTask("unknown_task_type", 0, {})
      } catch (err) {
        error = err as Error
      }
      expect(error).toBeInstanceOf(Error)
      expect(error!.message).toBe("Unknown task type: unknown_task_type")
    })
  })

  describe("ingestStorybook", () => {
    it("should process a storybook build and generate test results", async () => {
      const projectId = "test-project"
      const uploadId = "test-upload"
      const screenshotTestId = 123

      await ingestStorybook(projectId, screenshotTestId, uploadId)

      // Verify S3 interactions
      expect(S3Client).toHaveBeenCalled()
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetObjectCommand))

      // Verify screenshot test status updates
      expect(mockScreenshotTestSave).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.stringMatching(/^(no_changes|unapproved)$/),
          buildDurationSec: expect.any(Number),
        }),
      )

      // Verify test results were created
      expect(mockTestResultSave).toHaveBeenCalledWith(
        expect.objectContaining({
          storyId: "story1",
          screenshotTestId,
          changeStatus: expect.stringMatching(/^(new|unchanged|changed)$/),
          newImageUrl: expect.stringContaining(uploadId),
          diffRatio: expect.any(Number),
        }),
      )
    }, 10000)

    it("should handle missing base test results gracefully", async () => {
      // Setup database mock without base commit data
      const mockScreenshotTestNoBase = { ...mockScreenshotTest, baseCommitSha: undefined }
      vi.mocked(Database).mockImplementation(
        async () =>
          ({
            getRepository: vi.fn().mockImplementation((entity) => {
              if (entity === ScreenshotTest) {
                return {
                  findOneBy: vi.fn().mockResolvedValue(mockScreenshotTestNoBase),
                  save: mockScreenshotTestSave.mockImplementation(async (test: unknown) => {
                    log.debug("ScreenshotTest save called with:", test)
                    return test
                  }),
                } as unknown as Repository<ScreenshotTest>
              }
              return {
                createQueryBuilder: vi.fn().mockReturnValue({
                  innerJoin: vi.fn().mockReturnThis(),
                  where: vi.fn().mockReturnThis(),
                  getMany: vi.fn().mockResolvedValue([]),
                }),
                save: mockTestResultSave.mockImplementation(async (result: unknown) => {
                  log.debug("TestResult save called with:", result)
                  return result
                }),
              } as unknown as Repository<TestResult>
            }),
            "@instanceof": Symbol.for("TypeORM.DataSource"),
            name: "default",
            options: { type: "postgres", database: "test" } as DataSourceOptions,
            isInitialized: true,
          }) as unknown as DataSource,
      )

      log.debug("Starting ingestStorybook...")
      const promise = ingestStorybook("test-project", 123, "test-upload")
      log.debug("Waiting for ingestStorybook...")
      await promise
      log.debug("ingestStorybook completed")

      // Verify all test results are marked as "new" since there's no baseline
      expect(mockTestResultSave).toHaveBeenCalledWith(
        expect.objectContaining({
          changeStatus: "new",
        }),
      )
    })

    it("should handle storybook extraction failures", async () => {
      // Mock S3 to simulate a download failure
      vi.mocked(S3Client).mockImplementation(() => ({
        send: vi.fn().mockRejectedValue(new Error("S3 error")),
        config: {
          apiVersion: "2006-03-01",
          region: "us-east-1",
          credentials: {},
          logger: {},
          requestHandler: { handle: () => Promise.resolve({}) },
        } as unknown as S3ClientResolvedConfig,
        destroy: vi.fn(),
        middlewareStack: {} as unknown as MiddlewareStack<any, any>,
      }))

      await expect(ingestStorybook("test-project", 123, "test-upload")).rejects.toThrow("S3 error")

      // Verify screenshot test is marked as failed
      expect(mockScreenshotTestSave).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
        }),
      )

      // Verify no test results were created since we couldn't get the stories list
      expect(mockTestResultSave).not.toHaveBeenCalled()
    })
  })

  // Add a new test case for sweepStuckBuilds
  describe("sweepStuckBuilds", () => {
    // These mocks are explicitly typed with any to avoid TypeScript errors
    // when mocking complex database interactions for tests
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let mockGetMany: any
    let mockSave: any
    /* eslint-enable @typescript-eslint/no-explicit-any */

    beforeEach(() => {
      // Clear mocks
      vi.clearAllMocks()

      // Create mocks we can control in tests
      mockGetMany = vi.fn()
      mockSave = vi.fn()

      // Mock the database with a structure that matches our usage
      /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
      vi.mocked(Database).mockResolvedValue({
        getRepository: () => ({
          createQueryBuilder: () => ({
            where: () => ({
              andWhere: () => ({
                getMany: mockGetMany,
              }),
            }),
          }),
          save: mockSave,
        }),
      } as any)
      /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
    })

    it("should update stuck builds to failed status", async () => {
      // Setup mock data
      const threeHoursAgo = new Date()
      threeHoursAgo.setHours(threeHoursAgo.getHours() - 3)

      const stuckRunningBuild = {
        id: 1,
        status: "running",
        updatedAt: threeHoursAgo,
      }

      const stuckPendingBuild = {
        id: 2,
        status: "pending",
        updatedAt: threeHoursAgo,
      }

      // Mock responses for running and pending builds
      /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      mockGetMany.mockResolvedValueOnce([stuckRunningBuild])
      mockGetMany.mockResolvedValueOnce([stuckPendingBuild])
      /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

      // Run the function
      const count = await sweepStuckBuilds()

      // Verify the results
      expect(count).toBe(2)

      expect(mockSave).toHaveBeenCalledTimes(2)
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          status: "failed",
        }),
      )
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 2,
          status: "failed",
        }),
      )
    })

    it("should not update any builds if none are stuck", async () => {
      // Mock empty results
      /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      mockGetMany.mockResolvedValueOnce([])
      mockGetMany.mockResolvedValueOnce([])

      // Run the function
      const count = await sweepStuckBuilds()

      // Verify results
      expect(count).toBe(0)
      expect(mockSave).not.toHaveBeenCalled()
      /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    })

    it("should handle errors properly", async () => {
      // Mock error
      /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      mockGetMany.mockRejectedValueOnce(new Error("Database error"))
      /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

      // Verify the function throws
      await expect(sweepStuckBuilds()).rejects.toThrow("Database error")
    })
  })
})
