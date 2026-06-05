import { describe, expect, it, vi } from "vitest"

import { buildImageUrlResolver, presignImageUrl, presignImageUrlOrNull } from "./s3"

// Mock the presigner to echo the object key so we can assert what would be signed without AWS.
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(
    async (_client: unknown, command: { input: { Key: string } }, opts: { expiresIn: number }) =>
      `signed:${command.input.Key}?exp=${opts.expiresIn}`,
  ),
}))
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({})),
  GetObjectCommand: vi.fn((input: { Bucket: string; Key: string }) => ({ input })),
}))

describe("presignImageUrl", () => {
  it("presigns a stored object key", async () => {
    expect(await presignImageUrl("projects/1/a.png")).toMatch(/^signed:projects\/1\/a\.png\?exp=/)
  })

  it("extracts the key from a legacy full S3 URL", async () => {
    const url = "https://bucket.s3.amazonaws.com/projects/1/a.png"
    expect(await presignImageUrl(url)).toMatch(/^signed:projects\/1\/a\.png\?exp=/)
  })

  it("returns null for null input", async () => {
    expect(await presignImageUrlOrNull(null)).toBeNull()
  })
})

describe("buildImageUrlResolver", () => {
  it("resolves stored keys to presigned URLs and passes through nulls/unknowns", async () => {
    const results = [
      { newImageUrl: "k1", baselineImageUrl: "k2", diffImageUrl: null },
      { newImageUrl: "k1", baselineImageUrl: null, diffImageUrl: "k3" }, // k1 deduped
    ]
    const resolve = await buildImageUrlResolver(results)
    expect(resolve("k1")).toMatch(/^signed:k1\?/)
    expect(resolve("k2")).toMatch(/^signed:k2\?/)
    expect(resolve("k3")).toMatch(/^signed:k3\?/)
    expect(resolve(null)).toBeNull()
    expect(resolve("never-seen")).toBe("never-seen")
  })
})
