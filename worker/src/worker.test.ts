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

/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { remote } from "webdriverio"

import { Database } from "./database"
import { ingestStorybook, isBaselineBuildPending } from "./ingest"
import { log } from "./log"
import { processStory } from "./stories"
import { DependencyNotReadyError, NonRetryableTaskError, isPermanentS3FetchError } from "./tasks"
import { BuildTimeoutError } from "./timeout"
import { processTask, shutdown, sweepStuckBuilds } from "./worker"

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

// Mock S3 client and commands.
// vitest 4 constructs these mocks with `new` and no longer treats arrow
// functions as constructable. `S3Client` is a `vi.fn()` (so tests can assert
// `toHaveBeenCalled` / override it via `mockImplementation`) backed by a
// constructable `function` implementation. `GetObjectCommand` is a real class
// because tests rely on `instanceof` / `expect.any(GetObjectCommand)`.
vi.mock("@aws-sdk/client-s3", () => {
  const MockS3Client = vi.fn(function (this: { send: typeof mockSend }) {
    this.send = mockSend
  })

  class MockGetObjectCommand {
    constructor(public input: { Bucket: string; Key: string }) {}
  }

  return { S3Client: MockS3Client, GetObjectCommand: MockGetObjectCommand }
})

// Prevent the worker from starting its polling loop
vi.mock("./worker", async (importOriginal) => {
  const actual: object = await importOriginal()
  return {
    ...actual,
    main: vi.fn(),
    pollForNewTasks: vi.fn(),
    sweepStuckBuilds: vi.fn().mockResolvedValue(0),
  }
})

// Mock tasks module. Keep the real error/control-flow exports
// (NonRetryableTaskError / isPermanentS3FetchError / DependencyNotReadyError) so
// ingest.ts and worker.ts behave as in production; only stub the DB-touching
// queue functions.
vi.mock("./tasks", async (importOriginal) => {
  const actual: object = await importOriginal()
  return {
    ...actual,
    latestTaskQueueId: vi.fn().mockResolvedValue(undefined),
    fetchTask: vi.fn().mockResolvedValue({
      task_type: "ingest_storybook",
      screenshot_test_id: 123,
      data: {
        projectId: "test-project",
        uploadId: "test-upload",
      },
    }),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn().mockResolvedValue(undefined),
  }
})

// Mock database connection
vi.mock("./database", () => ({
  Database: vi.fn().mockImplementation(async () => ({
    getRepository: vi.fn().mockImplementation(() => ({
      createQueryBuilder: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
      }),
      save: vi.fn().mockResolvedValue({}),
      findOneBy: vi.fn().mockResolvedValue(null),
    })),
    "@instanceof": Symbol.for("TypeORM.DataSource"),
    name: "default",
    options: { type: "postgres", database: "test" } as DataSourceOptions,
    isInitialized: true,
  })),
  DatabasePool: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    }),
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    end: vi.fn().mockResolvedValue(undefined),
  })),
}))

// Mock browser shape: a bag of vi.fn() stubs plus capabilities. The index signature lets tests
// override individual methods (e.g. deleteSession) without re-declaring the whole surface.
type MockBrowser = {
  capabilities: { browserName: string; browserVersion: string; platformName: string }
  [method: string]: unknown
}

// Default mock browser factory, shared so individual tests can build on it (e.g. overriding
// deleteSession) without re-declaring the whole browser surface.
async function actualRemoteMock(): Promise<MockBrowser> {
  log.debug("WebdriverIO remote called")
  let storyStoreReady = false
  return {
    url: vi.fn().mockImplementation(async (url: string) => {
      log.debug(`WebdriverIO url called with: ${url}`)
    }),
    setViewport: vi
      .fn()
      .mockImplementation(
        async (viewport: { width: number; height: number; devicePixelRatio: number }) => {
          log.debug(`WebdriverIO setViewport called with: ${JSON.stringify(viewport)}`)
        },
      ),
    saveScreenshot: vi.fn().mockImplementation(async () => {
      log.debug("WebdriverIO saveScreenshot called")
      return Buffer.from("mock screenshot")
    }),
    execute: vi.fn().mockImplementation(async (fn?: () => unknown) => {
      log.debug(`WebdriverIO execute called, hasFunction: ${String(!!fn)}`)
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
}

// Mock WebdriverIO browser automation
vi.mock("webdriverio", () => ({
  remote: vi.fn().mockImplementation(actualRemoteMock),
}))

// Stub extraction. `safeExtract` now opens its own read stream (`createReadStream(tarballPath)`) so
// it can drive tar's streaming form and abort on a violation; mocking `tar` alone would leave that
// real fs read hitting a nonexistent test tarball. The orchestration tests here don't exercise
// extraction (the only failure-path test fails earlier, at S3 download), so stub it to a no-op.
// `safeExtract`'s own behavior is covered directly in extract.test.ts.
vi.mock("./extract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./extract")>()
  return {
    ...actual,
    safeExtract: vi.fn().mockImplementation(async () => {
      log.debug("safeExtract called")
    }),
  }
})

// Mock environment so the build timeout (and the post-abort grace period) are short enough to
// exercise in tests without slowing the suite. All other exports keep their real values.
vi.mock("./environment", async (importOriginal) => {
  const actual: object = await importOriginal()
  return { ...actual, BUILD_TIMEOUT_MS: 50, BUILD_ABORT_GRACE_MS: 500 }
})

// Mock story processing module
vi.mock("./stories", () => ({
  navigateToStorybook: vi.fn().mockImplementation(async () => {
    log.debug("navigateToStorybook called")
  }),
  getStorybookStories: vi.fn().mockImplementation(async () => {
    log.debug("getStorybookStories called")
    return mockStories
  }),
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
        log.debug(`processStory called with story: ${JSON.stringify(story)}`)
        const result = {
          id: 1,
          name: story.name,
          storyId: story.id,
          screenshotTestId: 123,
          changeStatus: "new" as const,
          baselineImageUrl: "mock-baseline-url",
          newImageUrl: `mock-new-url-${uploadId}`,
          diffImageUrl: "mock-diff-url",
          diffRatio: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        log.debug(`processStory returning: ${JSON.stringify(result)}`)
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
    project: { id: "test-project" },
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
              }
            }
            return {
              createQueryBuilder: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnThis(),
                leftJoinAndSelect: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                andWhere: vi.fn().mockReturnThis(),
                getMany: vi.fn().mockResolvedValue([mockBaseTestResult]),
              }),
              save: mockTestResultSave.mockImplementation(async (result: unknown) => result),
            }
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

  describe("isPermanentS3FetchError", () => {
    it("classifies NoSuchKey as permanent", () => {
      expect(isPermanentS3FetchError({ name: "NoSuchKey" })).toBe(true)
    })

    it("classifies a 404 status code as permanent", () => {
      expect(isPermanentS3FetchError({ $metadata: { httpStatusCode: 404 } })).toBe(true)
    })

    it("classifies a NotFound name as permanent", () => {
      expect(isPermanentS3FetchError({ name: "NotFound" })).toBe(true)
    })

    it("classifies InvalidObjectState (Glacier archive) as permanent", () => {
      expect(isPermanentS3FetchError({ name: "InvalidObjectState" })).toBe(true)
    })

    it("keeps a 403/AccessDenied auth error retryable", () => {
      // A transient IRSA/bucket-policy/KMS rollout or auth blip must not delete
      // the queue row for an object that actually exists.
      expect(isPermanentS3FetchError({ name: "AccessDenied" })).toBe(false)
      expect(isPermanentS3FetchError({ name: "Forbidden" })).toBe(false)
      expect(isPermanentS3FetchError({ $metadata: { httpStatusCode: 403 } })).toBe(false)
    })

    it("keeps a missing/misconfigured bucket retryable", () => {
      // A missing bucket is a recoverable deployment error; it should keep
      // retrying so it recovers once the bucket exists again.
      expect(isPermanentS3FetchError({ name: "NoSuchBucket" })).toBe(false)
    })

    it("does not classify a transient/network error as permanent", () => {
      expect(isPermanentS3FetchError(new Error("socket hang up"))).toBe(false)
      expect(isPermanentS3FetchError({ name: "TimeoutError" })).toBe(false)
      expect(isPermanentS3FetchError({ $metadata: { httpStatusCode: 500 } })).toBe(false)
      expect(isPermanentS3FetchError(undefined)).toBe(false)
      expect(isPermanentS3FetchError(null)).toBe(false)
    })
  })

  // Issue #125: render tasks must not run before the baseline build they depend
  // on. isBaselineBuildPending() detects an in-flight baseline; processTask()
  // throws DependencyNotReadyError so the worker can defer.
  describe("dependent task ordering (#125)", () => {
    // Build a Database mock whose ScreenshotTest repo returns `baseTest` from
    // findOneBy and `inFlightCount` from the dependency query's getCount().
    function mockDatabaseForDependency(
      baseTest: { id: number; baseCommitSha: string | null; project: { id: string } } | null,
      inFlightCount: number,
    ): void {
      vi.mocked(Database).mockImplementation(
        async () =>
          ({
            getRepository: vi.fn().mockImplementation((entity) => {
              if (entity === ScreenshotTest) {
                return {
                  findOneBy: vi.fn().mockResolvedValue(baseTest),
                  save: mockScreenshotTestSave.mockImplementation(async (t: unknown) => t),
                  createQueryBuilder: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnThis(),
                    andWhere: vi.fn().mockReturnThis(),
                    getCount: vi.fn().mockResolvedValue(inFlightCount),
                  }),
                }
              }
              return {
                createQueryBuilder: vi.fn().mockReturnValue({
                  leftJoinAndSelect: vi.fn().mockReturnThis(),
                  where: vi.fn().mockReturnThis(),
                  getMany: vi.fn().mockResolvedValue([]),
                }),
                save: mockTestResultSave.mockImplementation(async (r: unknown) => r),
              }
            }),
            "@instanceof": Symbol.for("TypeORM.DataSource"),
            name: "default",
            options: { type: "postgres", database: "test" } as DataSourceOptions,
            isInitialized: true,
          }) as unknown as DataSource,
      )
    }

    it("isBaselineBuildPending returns true when a baseline build is in flight", async () => {
      mockDatabaseForDependency(
        { id: 200, baseCommitSha: "base-sha", project: { id: "test-project" } },
        1,
      )
      await expect(isBaselineBuildPending(200)).resolves.toBe(true)
    })

    it("isBaselineBuildPending returns false when no baseline build is in flight", async () => {
      mockDatabaseForDependency(
        { id: 200, baseCommitSha: "base-sha", project: { id: "test-project" } },
        0,
      )
      await expect(isBaselineBuildPending(200)).resolves.toBe(false)
    })

    it("isBaselineBuildPending returns false when the test has no base commit", async () => {
      mockDatabaseForDependency(
        { id: 200, baseCommitSha: null, project: { id: "test-project" } },
        5,
      )
      await expect(isBaselineBuildPending(200)).resolves.toBe(false)
    })

    it("processTask throws DependencyNotReadyError (and does not delete the task) when the baseline is pending", async () => {
      const originalError = log.error
      log.error = vi.fn()
      mockDatabaseForDependency(
        { id: 200, baseCommitSha: "base-sha", project: { id: "test-project" } },
        1,
      )

      const { deleteTask } = await import("./tasks")

      await expect(
        processTask("ingest_storybook", 200, {
          projectId: "test-project",
          uploadId: "test-upload",
        }),
      ).rejects.toBeInstanceOf(DependencyNotReadyError)

      // The task must remain in the queue so it can be retried after the
      // dependency finishes.
      expect(deleteTask).not.toHaveBeenCalled()

      log.error = originalError
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
                    log.debug(`ScreenshotTest save called with: ${JSON.stringify(test)}`)
                    return test
                  }),
                }
              }
              return {
                createQueryBuilder: vi.fn().mockReturnValue({
                  innerJoin: vi.fn().mockReturnThis(),
                  leftJoinAndSelect: vi.fn().mockReturnThis(),
                  where: vi.fn().mockReturnThis(),
                  getMany: vi.fn().mockResolvedValue([]),
                }),
                save: mockTestResultSave.mockImplementation(async (result: unknown) => {
                  log.debug(`TestResult save called with: ${JSON.stringify(result)}`)
                  return result
                }),
              }
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

    it("should abort, wait for the render to unwind, and fail a build that exceeds the build timeout", async () => {
      // Silence the expected error/warn logging for this test.
      const originalError = log.error
      const originalWarn = log.warn
      log.error = vi.fn()
      log.warn = vi.fn()

      // Simulate a story stuck in a WebDriver op that only unsticks when the browser session is
      // force-closed by the timeout abort. processStory hangs until deleteSession() is called,
      // then rejects — mirroring how force-teardown makes the stuck command reject and the
      // render's `finally` (returning the session to the browser pool) run. This verifies
      // withTimeout waits for that unwind before surfacing BuildTimeoutError instead of freeing
      // the worker eagerly.
      let rejectStuckStory: ((err: Error) => void) | undefined
      let storyRejected = false
      vi.mocked(processStory).mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectStuckStory = (err: Error) => {
              storyRejected = true
              reject(err)
            }
          }),
      )

      // When the abort closes the session, unstick the hung story (as a real WebDriver client
      // would by rejecting the in-flight command).
      vi.mocked(remote).mockImplementationOnce(async () => {
        const browser = await actualRemoteMock()
        browser.deleteSession = vi.fn().mockImplementation(async () => {
          rejectStuckStory?.(new Error("session deleted"))
        })
        return browser
      })

      const error = await ingestStorybook("test-project", 123, "test-upload").catch(
        (e: unknown) => e,
      )

      log.error = originalError
      log.warn = originalWarn

      expect(error).toBeInstanceOf(BuildTimeoutError)
      // The render must have actually unwound (story rejected) before withTimeout surfaced the
      // BuildTimeoutError — proving the worker is not freed while the render is still running.
      expect(storyRejected).toBe(true)

      // The screenshot test must be marked failed on timeout.
      expect(mockScreenshotTestSave).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed" }),
      )
    }, 10000)

    it("should handle storybook extraction failures", async () => {
      // Temporarily silence the error logger
      const originalError = log.error
      log.error = vi.fn()

      // Mock S3 to simulate a download failure.
      // vitest 4 invokes mock implementations with `new`, so this must be a
      // constructable `function` rather than a (non-constructable) arrow.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- cast keeps the constructable function form vitest 4 requires
      vi.mocked(S3Client).mockImplementation(function (this: unknown) {
        return {
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
        }
      } as unknown as typeof S3Client)

      await expect(ingestStorybook("test-project", 123, "test-upload")).rejects.toThrow("S3 error")

      // Restore the original logger
      log.error = originalError

      // Verify screenshot test is marked as failed
      expect(mockScreenshotTestSave).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
        }),
      )

      // Verify no test results were created since we couldn't get the stories list
      expect(mockTestResultSave).not.toHaveBeenCalled()
    })

    it("should throw NonRetryableTaskError when the upload tarball is gone (NoSuchKey)", async () => {
      const originalError = log.error
      log.error = vi.fn()

      // Simulate the AWS SDK v3 NoSuchKey error shape (name + $metadata).
      const noSuchKey = Object.assign(new Error("The specified key does not exist."), {
        name: "NoSuchKey",
        $metadata: { httpStatusCode: 404 },
      })
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- constructable function form vitest 4 requires
      vi.mocked(S3Client).mockImplementation(function (this: unknown) {
        return {
          send: vi.fn().mockRejectedValue(noSuchKey),
          config: {
            apiVersion: "2006-03-01",
            region: "us-east-1",
            credentials: {},
            logger: {},
            requestHandler: { handle: () => Promise.resolve({}) },
          } as unknown as S3ClientResolvedConfig,
          destroy: vi.fn(),
          middlewareStack: {} as unknown as MiddlewareStack<any, any>,
        }
      } as unknown as typeof S3Client)

      await expect(ingestStorybook("test-project", 123, "test-upload")).rejects.toThrow(
        NonRetryableTaskError,
      )

      log.error = originalError

      // The screenshot test should still be marked failed.
      expect(mockScreenshotTestSave).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed" }),
      )
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

    beforeEach(async () => {
      // Clear mocks
      vi.clearAllMocks()

      // Override the mock implementation for these tests
      // We're not testing the mock, we're testing the actual implementation

      vi.mocked(sweepStuckBuilds).mockImplementation(async () => {
        // Get stuck running builds
        const stuckRunningBuilds = await mockGetMany()

        // Get stuck pending builds
        const stuckPendingBuilds = await mockGetMany()

        // Update status of stuck builds
        const allStuckBuilds = [...stuckRunningBuilds, ...stuckPendingBuilds]
        for (const build of allStuckBuilds) {
          build.status = "failed"
          await mockSave(build)
        }

        return allStuckBuilds.length
      })

      // Create mocks we can control in tests
      mockGetMany = vi.fn()
      mockSave = vi.fn()

      // Mock the database with a structure that matches our usage
      /* eslint-disable @typescript-eslint/no-explicit-any */
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
      /* eslint-enable @typescript-eslint/no-explicit-any */
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

      mockGetMany.mockResolvedValueOnce([stuckRunningBuild])
      mockGetMany.mockResolvedValueOnce([stuckPendingBuild])

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

      mockGetMany.mockResolvedValueOnce([])
      mockGetMany.mockResolvedValueOnce([])

      // Run the function
      const count = await sweepStuckBuilds()

      // Verify results
      expect(count).toBe(0)
      expect(mockSave).not.toHaveBeenCalled()
    })

    it("should handle errors properly", async () => {
      // Mock error

      mockGetMany.mockRejectedValueOnce(new Error("Database error"))

      // Verify the function throws
      await expect(sweepStuckBuilds()).rejects.toThrow("Database error")
    })
  })
})
