import { promises as fsPromises } from "node:fs"
import os from "node:os"
import path from "node:path"
import { create } from "tar"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { isUnsafePath, safeExtract, UnsafeTarballError, type SafeExtractLimits } from "./extract"

const LIMITS: SafeExtractLimits = {
  maxFiles: 100,
  maxEntryBytes: 1024,
  maxTotalBytes: 4096,
  maxPathLength: 256,
}

describe("isUnsafePath", () => {
  it("accepts normal relative paths", () => {
    expect(isUnsafePath("index.html")).toBe(false)
    expect(isUnsafePath("a/b/c.js")).toBe(false)
    expect(isUnsafePath("./iframe.html")).toBe(false)
  })

  it("rejects parent-directory traversal", () => {
    expect(isUnsafePath("../etc/passwd")).toBe(true)
    expect(isUnsafePath("a/../../b")).toBe(true)
    expect(isUnsafePath("..")).toBe(true)
  })

  it("rejects absolute paths", () => {
    expect(isUnsafePath("/etc/passwd")).toBe(true)
    expect(isUnsafePath("C:\\Windows\\system32")).toBe(true)
    expect(isUnsafePath("\\\\server\\share")).toBe(true)
  })

  it("rejects backslash traversal", () => {
    expect(isUnsafePath("a\\..\\..\\b")).toBe(true)
  })
})

describe("safeExtract", () => {
  let srcDir: string
  let outDir: string
  let tarballPath: string

  beforeEach(async () => {
    const base = await fsPromises.mkdtemp(path.join(os.tmpdir(), "safeextract-"))
    srcDir = path.join(base, "src")
    outDir = path.join(base, "out")
    tarballPath = path.join(base, "bundle.tar.gz")
    await fsPromises.mkdir(srcDir, { recursive: true })
    await fsPromises.mkdir(outDir, { recursive: true })
  })

  afterEach(async () => {
    // Aborting a hostile archive can leave a few already-dispatched fs writes in flight; retry the
    // teardown so it does not race them.
    await fsPromises.rm(path.dirname(srcDir), { recursive: true, force: true, maxRetries: 5 })
  })

  async function makeTarball(files: Record<string, string>): Promise<void> {
    for (const [name, content] of Object.entries(files)) {
      const filePath = path.join(srcDir, name)
      await fsPromises.mkdir(path.dirname(filePath), { recursive: true })
      await fsPromises.writeFile(filePath, content)
    }
    await create({ file: tarballPath, cwd: srcDir, gzip: true }, Object.keys(files))
  }

  // Builds a tarball that archives the given relative entry paths in order. Paths ending in "/" are
  // created as directories; everything else is a file. Used to exercise directory-heavy archives
  // and to control entry ordering (so the first entry can be the violating one).
  async function makeTarballFrom(entries: string[]): Promise<void> {
    for (const name of entries) {
      const full = path.join(srcDir, name)
      if (name.endsWith("/")) {
        await fsPromises.mkdir(full, { recursive: true })
      } else {
        await fsPromises.mkdir(path.dirname(full), { recursive: true })
        await fsPromises.writeFile(full, "x")
      }
    }
    await create({ file: tarballPath, cwd: srcDir, gzip: true }, entries)
  }

  it("extracts a normal storybook bundle", async () => {
    await makeTarball({
      "iframe.html": "<html></html>",
      "assets/main.js": "console.log(1)",
    })
    await safeExtract(tarballPath, outDir, LIMITS)
    const html = await fsPromises.readFile(path.join(outDir, "iframe.html"), "utf8")
    expect(html).toBe("<html></html>")
  })

  it("rejects a bundle exceeding the per-entry size limit", async () => {
    await makeTarball({ "big.bin": "x".repeat(LIMITS.maxEntryBytes + 1) })
    await expect(safeExtract(tarballPath, outDir, LIMITS)).rejects.toThrow(UnsafeTarballError)
    await expect(safeExtract(tarballPath, outDir, LIMITS)).rejects.toThrow(/too large/)
  })

  it("rejects a bundle exceeding the total extracted size limit (zip-bomb guard)", async () => {
    const chunk = "x".repeat(LIMITS.maxEntryBytes)
    await makeTarball({
      "a.bin": chunk,
      "b.bin": chunk,
      "c.bin": chunk,
      "d.bin": chunk,
      "e.bin": chunk,
    })
    await expect(safeExtract(tarballPath, outDir, LIMITS)).rejects.toThrow(/extracted size exceeds/)
  })

  it("rejects a bundle exceeding the file-count limit", async () => {
    const files: Record<string, string> = {}
    for (let i = 0; i < LIMITS.maxFiles + 1; i++) {
      files[`f${i}.txt`] = "x"
    }
    await makeTarball(files)
    await expect(safeExtract(tarballPath, outDir, LIMITS)).rejects.toThrow(/too many files/)
  })

  it("does not write files when a violation occurs", async () => {
    await makeTarball({ "ok.txt": "ok", "big.bin": "x".repeat(LIMITS.maxEntryBytes + 1) })
    await safeExtract(tarballPath, outDir, LIMITS).catch(() => undefined)
    // The oversized entry must never be written to disk.
    await expect(fsPromises.access(path.join(outDir, "big.bin"))).rejects.toThrow()
  })

  it("counts directory entries toward the file-count limit", async () => {
    // A tarball made entirely of directory entries (no regular files) must still be capped: many
    // directories consume inodes/time even though each reports size 0.
    const entries: string[] = []
    for (let i = 0; i < LIMITS.maxFiles + 1; i++) {
      entries.push(`d${i}/`)
    }
    await makeTarballFrom(entries)
    await expect(safeExtract(tarballPath, outDir, LIMITS)).rejects.toThrow(/too many files/)
  })

  it("aborts on the first violation without draining the whole archive", async () => {
    // The first entry is oversized; many more files follow it. The extraction stream must abort the
    // moment the first violation is seen, so the trailing entries are never written to disk.
    const oversized = "x".repeat(LIMITS.maxEntryBytes + 1)
    await fsPromises.writeFile(path.join(srcDir, "first-big.bin"), oversized)
    const entries = ["first-big.bin"]
    for (let i = 0; i < 50; i++) {
      const name = `after${i}.txt`
      await fsPromises.writeFile(path.join(srcDir, name), "x")
      entries.push(name)
    }
    await create({ file: tarballPath, cwd: srcDir, gzip: true }, entries)

    await expect(safeExtract(tarballPath, outDir, LIMITS)).rejects.toThrow(UnsafeTarballError)

    // Because extraction aborted on the first entry, none of the trailing entries were extracted.
    for (let i = 0; i < 50; i++) {
      await expect(fsPromises.access(path.join(outDir, `after${i}.txt`))).rejects.toThrow()
    }
  })

  it("disables a limit when set to 0", async () => {
    await makeTarball({ "big.bin": "x".repeat(LIMITS.maxEntryBytes + 1) })
    await expect(
      safeExtract(tarballPath, outDir, { ...LIMITS, maxEntryBytes: 0, maxTotalBytes: 0 }),
    ).resolves.toBeUndefined()
  })
})
