/**
 * This test suite verifies the storybook upload functionality.
 * The upload process:
 * 1. Validates input parameters
 * 2. Checks for storybook build manifest
 * 3. Creates a tarball of the build
 * 4. Uploads to the vizdiff API
 * 5. Cleans up temporary files
 *
 * We mock:
 * - File system operations
 * - HTTP requests (undici fetch)
 * - Compression (zip-a-folder)
 */

import { PathLike } from "fs"
import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import { fetch } from "undici"
import { expect, describe, it, beforeEach, vi, afterEach } from "vitest"
import { COMPRESSION_LEVEL, tar } from "zip-a-folder"

import { uploadStorybook, type UploadStorybookOpts } from "./upload-storybook"

vi.mock("fs/promises")
vi.mock("undici")
vi.mock("zip-a-folder")
vi.mock("./log", () => ({
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}))

type FetchOptions = {
  method: string
  headers: Record<string, string>
  body: Buffer
}

function str(filepath: PathLike | fs.FileHandle): string {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return filepath.toString()
}

describe("upload-storybook", () => {
  // Test fixtures
  const validOpts: UploadStorybookOpts = {
    storybookDir: "/path/to/storybook",
    commitSha: "a".repeat(40),
    branch: "main",
    projectToken: "test-token",
    baseCommitSha: "b".repeat(40),
    baseBranch: "develop",
  }

  const mockProjectJson = {
    storybookVersion: "7.0.0",
    framework: { name: "react" },
  }

  const mockIndexJson = {
    v: 5,
    entries: {
      "story-1": { name: "Story 1", type: "story", importPath: "./stories/1.js", tags: ["a"] },
      "story-2": { name: "Story 2", type: "story", importPath: "./stories/2.js", tags: ["b"] },
    },
  }

  const mockTarballContent = Buffer.from("mock tarball content")

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Mock successful file system operations
    vi.mocked(fs.access).mockResolvedValue(undefined)
    vi.mocked(fs.readFile).mockImplementation(async (filepath) => {
      const resolvedPath = path.resolve(str(filepath))
      if (resolvedPath === path.resolve(validOpts.storybookDir, "project.json")) {
        return JSON.stringify(mockProjectJson)
      }
      if (resolvedPath === path.resolve(validOpts.storybookDir, "index.json")) {
        return JSON.stringify(mockIndexJson)
      }
      // Check if it's the tarball path (random name in tmpdir)
      if (str(filepath).includes(os.tmpdir())) {
        return mockTarballContent
      }
      // Default case or error? For now, let's assume it's the tarball
      return mockTarballContent
      // throw new Error(`Unexpected readFile call: ${filepath}`); // Stricter alternative
    })
    vi.mocked(fs.unlink).mockResolvedValue(undefined)

    // Mock successful tarball creation
    vi.mocked(tar).mockResolvedValue(undefined)

    // Mock successful API response
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ success: true, testId: "test-123", uploadId: "upload-456" }),
    } as Response)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("input validation", () => {
    it("should throw on invalid commit SHA", async () => {
      const opts = { ...validOpts, commitSha: "invalid" }
      await expect(uploadStorybook(opts)).rejects.toThrow('Invalid commit SHA: "invalid"')
    })

    it("should throw on empty branch name", async () => {
      const opts = { ...validOpts, branch: "" }
      await expect(uploadStorybook(opts)).rejects.toThrow('Invalid branch name: ""')
    })

    it("should throw on branch name too long", async () => {
      const opts = { ...validOpts, branch: "a".repeat(256) }
      await expect(uploadStorybook(opts)).rejects.toThrow(
        `Invalid branch name: "${"a".repeat(256)}"`,
      )
    })
  })

  describe("storybook manifest validation", () => {
    it("should throw if project.json doesn't exist", async () => {
      vi.mocked(fs.access).mockImplementation(async (filepath) => {
        if (filepath === path.resolve(validOpts.storybookDir, "project.json")) {
          throw new Error("ENOENT")
        }
      })
      await expect(uploadStorybook(validOpts)).rejects.toThrow(
        "Storybook build manifest does not exist",
      )
    })

    it("should throw if project.json is invalid JSON", async () => {
      vi.mocked(fs.readFile).mockImplementation(async (filepath) => {
        if (str(filepath) === path.resolve(validOpts.storybookDir, "project.json")) {
          return "invalid json"
        }
        if (str(filepath) === path.resolve(validOpts.storybookDir, "index.json")) {
          return JSON.stringify(mockIndexJson)
        }
        return mockTarballContent
      })
      await expect(uploadStorybook(validOpts)).rejects.toThrow("Failed to parse project.json file")
    })

    it("should throw if project.json is missing required fields", async () => {
      vi.mocked(fs.readFile).mockImplementation(async (filepath) => {
        if (str(filepath) === path.resolve(validOpts.storybookDir, "project.json")) {
          return JSON.stringify({})
        }
        if (str(filepath) === path.resolve(validOpts.storybookDir, "index.json")) {
          return JSON.stringify(mockIndexJson)
        }
        return mockTarballContent
      })
      await expect(uploadStorybook(validOpts)).rejects.toThrow("Invalid project.json file")
    })
  })

  describe("index.json validation", () => {
    it("should throw if index.json cannot be read", async () => {
      vi.mocked(fs.readFile).mockImplementation(async (filepath) => {
        if (str(filepath) === path.resolve(validOpts.storybookDir, "project.json")) {
          return JSON.stringify(mockProjectJson)
        }
        if (str(filepath) === path.resolve(validOpts.storybookDir, "index.json")) {
          throw new Error("Read error")
        }
        return mockTarballContent
      })
      await expect(uploadStorybook(validOpts)).rejects.toThrow("Failed to parse index.json file")
    })

    it("should throw if index.json is invalid JSON", async () => {
      vi.mocked(fs.readFile).mockImplementation(async (filepath) => {
        if (str(filepath) === path.resolve(validOpts.storybookDir, "project.json")) {
          return JSON.stringify(mockProjectJson)
        }
        if (str(filepath) === path.resolve(validOpts.storybookDir, "index.json")) {
          return "invalid json"
        }
        return mockTarballContent
      })
      await expect(uploadStorybook(validOpts)).rejects.toThrow("Failed to parse index.json file")
    })

    it("should throw if index.json has no entries", async () => {
      vi.mocked(fs.readFile).mockImplementation(async (filepath) => {
        if (str(filepath) === path.resolve(validOpts.storybookDir, "project.json")) {
          return JSON.stringify(mockProjectJson)
        }
        if (str(filepath) === path.resolve(validOpts.storybookDir, "index.json")) {
          return JSON.stringify({ v: 5, entries: {} }) // Empty entries
        }
        return mockTarballContent
      })
      await expect(uploadStorybook(validOpts)).rejects.toThrow(
        "No stories found in index.json file",
      )
    })

    it("should throw if index.json is missing entries field", async () => {
      vi.mocked(fs.readFile).mockImplementation(async (filepath) => {
        if (str(filepath) === path.resolve(validOpts.storybookDir, "project.json")) {
          return JSON.stringify(mockProjectJson)
        }
        if (str(filepath) === path.resolve(validOpts.storybookDir, "index.json")) {
          return JSON.stringify({ v: 5 }) // Missing entries
        }
        return mockTarballContent
      })
      await expect(uploadStorybook(validOpts)).rejects.toThrow(
        "No stories found in index.json file",
      )
    })
  })

  describe("tarball creation", () => {
    it("should create tarball with correct compression level", async () => {
      await uploadStorybook(validOpts)
      expect(tar).toHaveBeenCalledWith(validOpts.storybookDir, expect.any(String), {
        compression: COMPRESSION_LEVEL.medium,
      })
    })

    it("should throw if tarball creation fails", async () => {
      vi.mocked(tar).mockResolvedValue(new Error("Compression failed"))
      await expect(uploadStorybook(validOpts)).rejects.toThrow(
        "Failed to tar+gzip storybook build folder",
      )
    })
  })

  describe("API upload", () => {
    it("should upload to default API URL if not configured", async () => {
      await uploadStorybook(validOpts)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("https://vizdiff.io/api/upload/storybook"),
        expect.any(Object),
      )
    })

    it("should use custom API URL if configured", async () => {
      process.env.VIZDIFF_API_URL = "https://custom.vizdiff.io"
      await uploadStorybook(validOpts)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("https://custom.vizdiff.io/upload/storybook"),
        expect.any(Object),
      )
      delete process.env.VIZDIFF_API_URL
    })

    it("should include all required headers", async () => {
      await uploadStorybook(validOpts)
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          headers: expect.objectContaining({
            "Content-Type": "application/gzip",
            "X-Vizdiff-Commit-Sha": validOpts.commitSha,
            "X-Vizdiff-Branch": validOpts.branch,
            "X-Vizdiff-Base-Commit-Sha": validOpts.baseCommitSha,
            "X-Vizdiff-Base-Branch": validOpts.baseBranch,
          }),
        }),
      )
    })

    it("should omit optional base headers if not provided", async () => {
      const optsWithoutBase = {
        ...validOpts,
        baseCommitSha: undefined,
        baseBranch: undefined,
      }
      await uploadStorybook(optsWithoutBase)
      const fetchCall = vi.mocked(fetch).mock.calls[0]
      if (!fetchCall) {
        throw new Error("Expected fetch to be called")
      }
      const [, options] = fetchCall as [string, FetchOptions]
      expect(options.headers).not.toHaveProperty("X-Vizdiff-Base-Commit-Sha")
      expect(options.headers).not.toHaveProperty("X-Vizdiff-Base-Branch")
    })

    it("should throw on non-200 response", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      } as Response)
      await expect(uploadStorybook(validOpts)).rejects.toThrow(
        "Failed to upload storybook build folder to vizdiff CDN: Forbidden (403)",
      )
    })

    it("should throw on API error response", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ success: false, error: "Invalid project token" }),
      } as Response)
      await expect(uploadStorybook(validOpts)).rejects.toThrow(
        "Failed to upload storybook build folder to vizdiff CDN: Invalid project token",
      )
    })
  })

  describe("cleanup", () => {
    it("should delete tarball after successful upload", async () => {
      await uploadStorybook(validOpts)
      expect(fs.unlink).toHaveBeenCalled()
    })

    it("should attempt to delete tarball even if upload fails", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Upload failed"))
      await expect(uploadStorybook(validOpts)).rejects.toThrow()
      expect(fs.unlink).toHaveBeenCalled()
    })
  })
})
