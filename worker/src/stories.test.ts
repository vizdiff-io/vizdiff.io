import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import type { WriteStream } from "node:fs"
import { PNG } from "pngjs"
import { TestResult, ScreenshotTest } from "shared"
import { Readable } from "stream"
import type { Repository } from "typeorm"
import { expect, describe, it, vi, beforeEach } from "vitest"
import type { Browser } from "webdriverio"

import { processStory } from "./stories"

/**
 * Test suite for the screenshot comparison functionality.
 *
 * The processStory function:
 * 1. Takes a screenshot of a Storybook story
 * 2. Uploads it to S3
 * 3. Downloads the baseline image (if it exists)
 * 4. Compares the images and determines if there are changes
 * 5. Saves the results to the database
 */

// Mock function declarations for all external dependencies
const mockSend = vi.fn()
const mockTestResultSave = vi.fn()
const mockBrowserUrl = vi.fn()
const mockBrowserExecute = vi.fn()
const mockBrowserSaveScreenshot = vi.fn()
const mockBrowserPause = vi.fn()

/**
 * Mock S3 client for testing file uploads/downloads
 * - GetObjectCommand: Downloads baseline images
 * - PutObjectCommand: Uploads new screenshots and diff images
 */
vi.mock("@aws-sdk/client-s3", () => {
  class MockGetObjectCommand {
    constructor(public input: { Bucket: string; Key: string }) {}
  }
  Object.defineProperty(MockGetObjectCommand, Symbol.hasInstance, {
    value: (instance: unknown) => instance?.constructor === MockGetObjectCommand,
  })

  class MockPutObjectCommand {
    constructor(
      public input: { Bucket: string; Key: string; Body: Buffer | string; ContentType?: string },
    ) {}
  }
  Object.defineProperty(MockPutObjectCommand, Symbol.hasInstance, {
    value: (instance: unknown) => instance?.constructor === MockPutObjectCommand,
  })

  return {
    S3Client: vi.fn(() => ({ send: mockSend })),
    GetObjectCommand: Object.assign(
      vi.fn((input: { Bucket: string; Key: string }) => new MockGetObjectCommand(input)),
      { prototype: MockGetObjectCommand.prototype },
    ),
    PutObjectCommand: Object.assign(
      vi.fn(
        (input: { Bucket: string; Key: string; Body: Buffer | string; ContentType?: string }) =>
          new MockPutObjectCommand(input),
      ),
      { prototype: MockPutObjectCommand.prototype },
    ),
  }
})

/**
 * Creates a mock write stream that properly handles Node.js stream events.
 * This is crucial for testing the S3 download functionality which uses streams.
 */
function createMockWriteStream(): WriteStream {
  const handlers = new Map<string, Array<() => void>>()

  const writeStream = {
    on: vi.fn().mockImplementation((event: string, callback: () => void) => {
      const eventHandlers = handlers.get(event) ?? []
      eventHandlers.push(callback)
      handlers.set(event, eventHandlers)
      return writeStream
    }),
    once: vi.fn().mockImplementation((event: string, callback: () => void) => {
      const eventHandlers = handlers.get(event) ?? []
      eventHandlers.push(callback)
      handlers.set(event, eventHandlers)
      return writeStream
    }),
    removeListener: vi.fn().mockImplementation((event: string, callback: () => void) => {
      const eventHandlers = handlers.get(event) ?? []
      const index = eventHandlers.indexOf(callback)
      if (index !== -1) {
        eventHandlers.splice(index, 1)
        handlers.set(event, eventHandlers)
      }
      return writeStream
    }),
    removeAllListeners: vi.fn().mockImplementation((event?: string) => {
      if (event) {
        handlers.delete(event)
      } else {
        handlers.clear()
      }
      return writeStream
    }),
    pipe: vi.fn().mockImplementation((readableStream: Readable) => {
      // Simulate the pipe operation by reading from the stream
      readableStream.on("data", (chunk: Buffer) => {
        writeStream.write(chunk)
      })
      readableStream.on("end", () => {
        writeStream.end()
        const finishHandlers = handlers.get("finish") ?? []
        finishHandlers.forEach((handler) => handler())
      })
      return writeStream
    }),
    write: vi.fn(),
    end: vi.fn().mockImplementation(() => {
      const finishHandlers = handlers.get("finish") ?? []
      finishHandlers.forEach((handler) => handler())
      return true
    }),
    emit: vi.fn().mockImplementation((event: string) => {
      const eventHandlers = handlers.get(event) ?? []
      eventHandlers.forEach((handler) => handler())
      return true
    }),
    bytesWritten: 0,
    path: "",
    pending: false,
    writable: true,
  } as unknown as WriteStream
  return writeStream
}

/**
 * Mock filesystem operations
 * - readFile: Returns different mock data for baseline vs new images
 * - writeFile: Used for saving diff images
 * - mkdir/rm: Used for temp directory management
 */
vi.mock("node:fs", () => {
  const fs = {
    createWriteStream: () => createMockWriteStream(),
    createReadStream: vi.fn(),
    promises: {
      readFile: vi.fn((path: string) => {
        if (path.endsWith("-baseline.png")) {
          return Promise.resolve(Buffer.from("mock baseline image"))
        }
        if (path.endsWith(".png")) {
          return Promise.resolve(Buffer.from("mock new image"))
        }
        return Promise.resolve(Buffer.from("mock image data"))
      }),
      writeFile: vi.fn(),
      mkdir: () => Promise.resolve(),
      rm: () => Promise.resolve(),
    },
  }
  return { default: fs, promises: fs.promises }
})

// Remove the separate fs/promises mock since it's now part of the fs mock
vi.unmock("node:fs/promises")

/**
 * Mock pixelmatch (image comparison library)
 * Returns:
 * - 0 when images are identical
 * - width * height (all pixels different) when images differ
 */
vi.mock("pixelmatch", () => {
  return {
    default: (
      img1: Buffer,
      img2: Buffer,
      _output: Buffer,
      width: number,
      height: number,
      _options?: unknown,
    ) => {
      // If both buffers contain the same data, return 0 differences
      if (img1.toString() === img2.toString()) {
        return 0
      }
      // Otherwise return width * height (all pixels different)
      return width * height
    },
  }
})

/**
 * Mock PNG operations with different behaviors for test scenarios:
 * 1. Unchanged test: Both images have same dimensions and content
 * 2. Dimension mismatch test: Baseline is 200x100, new image is 100x100
 * 3. New image test: No special handling needed
 */
vi.mock("pngjs", () => {
  let currentTest = ""

  class MockPNG {
    width: number
    height: number
    data: Buffer

    constructor(options?: { width?: number; height?: number }) {
      this.width = options?.width ?? 100
      this.height = options?.height ?? 100
      this.data = Buffer.alloc(this.width * this.height * 4)
    }

    static get sync() {
      return {
        read: (buffer: Buffer) => {
          // For dimension mismatch test, return different sized images
          if (currentTest === "dimension_mismatch" && buffer.toString() === "mock baseline image") {
            return {
              width: 200,
              height: 100,
              data: Buffer.from([0, 0, 0, 255]),
            }
          }
          // For all other cases, return standard size images
          return {
            width: 100,
            height: 100,
            data: Buffer.from([0, 0, 0, 255]),
          }
        },
        write: (_png: MockPNG) => Buffer.from("mock diff image"),
      }
    }

    static setTestMode(mode: string): void {
      currentTest = mode
    }
  }

  return { PNG: MockPNG }
})

describe("processStory", () => {
  // Mock story data that would come from Storybook
  const mockStory = {
    id: "stories-components-teststory--mycomponent",
    name: "My Component",
    title: "stories/components/TestStory",
    importPath: "./stories/Test.stories.tsx",
    componentPath: "./stories/Test.stories.tsx",
    tags: ["dev", "test"],
  }

  // Mock ScreenshotTest instance
  const mockScreenshotTest = new ScreenshotTest()
  Object.assign(mockScreenshotTest, {
    id: 123,
    status: "pending",
    buildNumber: 1,
    commitSha: "1234567890123456789012345678901234567890",
    branch: "main",
    uploadId: "abcdef",
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  // Mock WebdriverIO browser instance for taking screenshots
  const mockBrowser = {
    url: mockBrowserUrl,
    execute: mockBrowserExecute,
    saveScreenshot: mockBrowserSaveScreenshot.mockImplementation(async () =>
      Buffer.from("mock screenshot data"),
    ),
    pause: mockBrowserPause,
    waitUntil: vi.fn().mockImplementation(async (fn: () => Promise<unknown>) => {
      await fn()
      return true
    }),
    isMultiremote: false,
    capabilities: {},
    sessionId: "mock-session",
    options: {},
  } as unknown as Browser

  // Make the mock browser globally available (required by processStory)
  global.browser = mockBrowser

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()

    // Reset PNG mock state
    ;(PNG as unknown as { setTestMode(mode: string): void }).setTestMode("")

    // Setup S3 mock behavior
    mockSend.mockImplementation(async (command) => {
      if (command instanceof GetObjectCommand) {
        // Extract uploadId from the key path
        const key = command.input.Key ?? ""
        const match = /screenshots\/([\w-]+)\//.exec(key)
        const uploadId = match?.[1]
        if (uploadId === "xyz789") {
          // Return mock stream with baseline image data
          return {
            Body: new Readable({
              read() {
                this.push(Buffer.from("mock baseline image"))
                this.push(null)
              },
            }),
          }
        }
        throw new Error(`Baseline not found for uploadId: ${uploadId}`)
      }
      if (command instanceof PutObjectCommand) {
        return command
      }
      return {}
    })
  })

  /**
   * Test case 1: New story without baseline
   * Verifies that:
   * - Screenshot is taken and uploaded to S3
   * - No baseline comparison is attempted
   * - Result is marked as "new"
   */
  it("should process a new story without baseline", async () => {
    const testResult = await processStory({
      story: mockStory,
      screenshotTest: mockScreenshotTest,
      bucket: "test-bucket",
      tmpDir: "/tmp/test",
      projectId: "test-project",
      uploadId: "123",
      port: 9009,
      s3Client: new S3Client({}),
      testResultTable: {
        save: mockTestResultSave.mockImplementation(async (data: TestResult) => data),
      } as unknown as Repository<TestResult>,
      browser: mockBrowser,
    })

    // Verify browser interactions
    expect(mockBrowserUrl).toHaveBeenCalledWith(
      "http://localhost:9009/iframe.html?id=stories-components-teststory--mycomponent",
    )
    expect(mockBrowserSaveScreenshot).toHaveBeenCalled()

    // Verify S3 upload
    type S3CommandInput = {
      input: {
        Bucket: string
        Key: string
        Body?: Buffer | string
        ContentType?: string
      }
    }
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining<S3CommandInput>({
        input: {
          Bucket: "test-bucket",
          Key: "projects/test-project/screenshots/123/stories-components-teststory--mycomponent.png",
          Body: expect.any(Buffer) as Buffer,
          ContentType: "image/png",
        },
      }),
    )

    // Verify test result
    expect(testResult.changeStatus).toBe("new")
    expect(testResult.diffRatio).toBe(0)
    expect(testResult.name).toBe("components/TestStory/My Component")
    expect(testResult.storyId).toBe("stories-components-teststory--mycomponent")
    expect(testResult.screenshotTest.id).toBe(123)
  })

  /**
   * Test case 2: Story matches baseline
   * Verifies that:
   * - Screenshot is taken and uploaded
   * - Baseline is downloaded from S3
   * - Images are compared and found identical
   * - Result is marked as "unchanged"
   */
  it("should process a story with no change from baseline", async () => {
    ;(PNG as unknown as { setTestMode(mode: string): void }).setTestMode("unchanged")
    const baseTestResult = new TestResult()
    Object.assign(baseTestResult, {
      id: 789,
      name: "Test Story",
      storyId: "test-story",
      screenshotTestId: 456,
      screenshotTest: {
        id: 456,
        uploadId: "xyz789",
      },
      baselineImageUrl: "https://test-bucket.s3.amazonaws.com/baseline.png",
      newImageUrl: "https://test-bucket.s3.amazonaws.com/new.png",
      diffImageUrl: "https://test-bucket.s3.amazonaws.com/diff.png",
      diffRatio: 0,
      changeStatus: "new",
    })

    const testResult = await processStory({
      story: mockStory,
      screenshotTest: mockScreenshotTest,
      baseTestResult,
      bucket: "test-bucket",
      tmpDir: "/tmp/test",
      projectId: "test-project",
      uploadId: "xyz789",
      port: 9009,
      s3Client: new S3Client({}),
      testResultTable: {
        save: mockTestResultSave.mockImplementation(async (data: TestResult) => data),
      } as unknown as Repository<TestResult>,
      browser: mockBrowser,
    })

    expect(testResult.changeStatus).toBe("unchanged")
    expect(testResult.diffRatio).toBeLessThan(0.001)
  })

  /**
   * Test case 3: Image dimension mismatch
   * Verifies that:
   * - When baseline image has different dimensions (200x100 vs 100x100)
   * - Result is marked as "changed" without pixel comparison
   * - Diff ratio is set to 1 (maximum difference)
   */
  it("should handle baseline image dimension mismatch", async () => {
    ;(PNG as unknown as { setTestMode(mode: string): void }).setTestMode("dimension_mismatch")
    const baseTestResult = new TestResult()
    Object.assign(baseTestResult, {
      id: 789,
      name: "Test Story",
      storyId: "test-story",
      screenshotTestId: 456,
      screenshotTest: {
        id: 456,
        uploadId: "xyz789",
      },
      baselineImageUrl: "https://test-bucket.s3.amazonaws.com/baseline.png",
      newImageUrl: "https://test-bucket.s3.amazonaws.com/new.png",
      diffImageUrl: "https://test-bucket.s3.amazonaws.com/diff.png",
      diffRatio: 0,
      changeStatus: "unchanged",
    })

    const testResult = await processStory({
      story: mockStory,
      screenshotTest: mockScreenshotTest,
      baseTestResult,
      bucket: "test-bucket",
      tmpDir: "/tmp/test",
      projectId: "test-project",
      uploadId: "xyz789",
      port: 9009,
      s3Client: new S3Client({}),
      testResultTable: {
        save: mockTestResultSave.mockImplementation(async (data: TestResult) => data),
      } as unknown as Repository<TestResult>,
      browser: mockBrowser,
    })

    expect(testResult.changeStatus).toBe("changed")
    expect(testResult.diffRatio).toBe(1)
  })

  /**
   * Test case 4: Screenshot retry on failure
   * Verifies that:
   * - First screenshot attempt fails
   * - Code waits 1 second
   * - Second attempt succeeds
   * - Processing continues normally
   */
  it("should retry screenshot on failure", async () => {
    mockBrowserSaveScreenshot
      .mockRejectedValueOnce(new Error("Screenshot failed"))
      .mockResolvedValueOnce(Buffer.from("mock screenshot"))

    await processStory({
      story: mockStory,
      screenshotTest: mockScreenshotTest,
      bucket: "test-bucket",
      tmpDir: "/tmp/test",
      projectId: "test-project",
      uploadId: "123",
      port: 9009,
      s3Client: new S3Client({}),
      testResultTable: {
        save: mockTestResultSave.mockImplementation(async (data: TestResult) => data),
      } as unknown as Repository<TestResult>,
      browser: mockBrowser,
    })

    expect(mockBrowserSaveScreenshot).toHaveBeenCalledTimes(2)
    expect(mockBrowserPause).toHaveBeenCalledWith(1000)
  })

  /**
   * Test case 5: Missing baseline handling
   * Verifies that:
   * - When S3 fails to provide baseline image
   * - Process continues gracefully
   * - Result is marked as "new"
   */
  it("should handle missing baseline gracefully", async () => {
    const baseTestResult = new TestResult()
    Object.assign(baseTestResult, {
      id: 789,
      name: "Test Story",
      storyId: "test-story",
      screenshotTestId: 456,
      screenshotTest: {
        id: 456,
        uploadId: "xyz789",
      },
      baselineImageUrl: "https://test-bucket.s3.amazonaws.com/baseline.png",
      newImageUrl: "https://test-bucket.s3.amazonaws.com/new.png",
      diffImageUrl: "https://test-bucket.s3.amazonaws.com/diff.png",
      diffRatio: 0,
      changeStatus: "unchanged",
    })

    // Mock S3 error when fetching baseline
    mockSend.mockImplementation(async (command) => {
      if (command instanceof GetObjectCommand) {
        throw new Error("Baseline not found")
      }
      if (command instanceof PutObjectCommand) {
        return { input: command.input }
      }
      return {}
    })

    const testResult = await processStory({
      story: mockStory,
      screenshotTest: mockScreenshotTest,
      baseTestResult,
      bucket: "test-bucket",
      tmpDir: "/tmp/test",
      projectId: "test-project",
      uploadId: mockScreenshotTest.uploadId,
      port: 9009,
      s3Client: new S3Client({}),
      testResultTable: {
        save: mockTestResultSave.mockImplementation(async (data: TestResult) => data),
      } as unknown as Repository<TestResult>,
      browser: mockBrowser,
    })

    expect(testResult.changeStatus).toBe("new")
    expect(testResult.diffRatio).toBe(0)
  })
})
