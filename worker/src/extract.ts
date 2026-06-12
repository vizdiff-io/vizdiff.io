import path from "node:path"
import { extract, type ReadEntry } from "tar"

import {
  MAX_EXTRACTED_BYTES,
  MAX_TARBALL_ENTRY_BYTES,
  MAX_TARBALL_FILES,
  MAX_TARBALL_PATH_LENGTH,
} from "./environment"
import { log } from "./log"

export interface SafeExtractLimits {
  maxFiles: number
  maxEntryBytes: number
  maxTotalBytes: number
  maxPathLength: number
}

export const DEFAULT_EXTRACT_LIMITS: SafeExtractLimits = {
  maxFiles: MAX_TARBALL_FILES,
  maxEntryBytes: MAX_TARBALL_ENTRY_BYTES,
  maxTotalBytes: MAX_EXTRACTED_BYTES,
  maxPathLength: MAX_TARBALL_PATH_LENGTH,
}

/**
 * Error thrown when a tarball fails a sanity/safety check during extraction. Distinct from generic
 * extraction failures so callers can attribute the failure to a bad upload.
 */
export class UnsafeTarballError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnsafeTarballError"
  }
}

/**
 * Returns true if `entryPath` would escape `cwd` (path traversal) or is an absolute path.
 * The `tar` package already strips these by default, but we reject the whole upload instead of
 * silently skipping so a malicious tarball is treated as an error rather than partially extracted.
 */
export function isUnsafePath(entryPath: string): boolean {
  // Absolute paths (POSIX or Windows drive / UNC) are never allowed.
  if (
    path.isAbsolute(entryPath) ||
    /^[a-zA-Z]:[\\/]/.test(entryPath) ||
    entryPath.startsWith("\\")
  ) {
    return true
  }
  // Normalize using POSIX semantics, treating backslashes as separators to catch Windows-style
  // traversal embedded in a tar entry.
  const normalized = path.posix.normalize(entryPath.replace(/\\/g, "/"))
  if (normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    return true
  }
  return false
}

/**
 * Extracts a `.tar.gz` to `cwd` while enforcing sanity limits on untrusted uploads:
 * - rejects path traversal (`../`) and absolute paths
 * - caps the number of entries (file-count guard)
 * - caps per-entry and total uncompressed size (zip-bomb guard)
 * - caps the entry path length
 *
 * On any violation an {@link UnsafeTarballError} is thrown. Because the `tar` `filter` callback is
 * synchronous and cannot reject the stream directly, the first violation is captured and re-thrown
 * after extraction settles.
 */
export async function safeExtract(
  tarballPath: string,
  cwd: string,
  limits: SafeExtractLimits = DEFAULT_EXTRACT_LIMITS,
): Promise<void> {
  let fileCount = 0
  let totalBytes = 0
  let violation: UnsafeTarballError | undefined

  const recordViolation = (message: string): false => {
    // Keep only the first violation so the attributed error is deterministic.
    violation ??= new UnsafeTarballError(message)
    return false
  }

  const filter = (entryPath: string, entry: ReadEntry): boolean => {
    if (violation) {
      return false
    }

    if (limits.maxPathLength > 0 && entryPath.length > limits.maxPathLength) {
      return recordViolation(
        `Tarball entry path too long: ${entryPath.length} chars (max ${limits.maxPathLength})`,
      )
    }

    if (isUnsafePath(entryPath)) {
      return recordViolation(`Tarball contains unsafe path: "${entryPath}"`)
    }

    // Reject hard/symbolic links that point outside the extraction root.
    if ((entry.type === "Link" || entry.type === "SymbolicLink") && entry.linkpath != undefined) {
      if (isUnsafePath(entry.linkpath)) {
        return recordViolation(
          `Tarball contains link "${entryPath}" -> unsafe target "${entry.linkpath}"`,
        )
      }
    }

    // Only count and size-check actual file/link entries (directories report size 0).
    const isFileLike =
      entry.type === "File" ||
      entry.type === "ContiguousFile" ||
      entry.type === "OldFile" ||
      entry.type === "Link" ||
      entry.type === "SymbolicLink"

    if (isFileLike) {
      fileCount++
      if (limits.maxFiles > 0 && fileCount > limits.maxFiles) {
        return recordViolation(`Tarball contains too many files (max ${limits.maxFiles})`)
      }

      const size = entry.size
      if (limits.maxEntryBytes > 0 && size > limits.maxEntryBytes) {
        return recordViolation(
          `Tarball entry "${entryPath}" too large: ${size} bytes (max ${limits.maxEntryBytes})`,
        )
      }

      totalBytes += size
      if (limits.maxTotalBytes > 0 && totalBytes > limits.maxTotalBytes) {
        return recordViolation(
          `Tarball extracted size exceeds limit: ${totalBytes} bytes (max ${limits.maxTotalBytes})`,
        )
      }
    }

    return true
  }

  await extract({ file: tarballPath, cwd, filter })

  if (violation) {
    log.warn({ tarballPath, fileCount, totalBytes }, violation.message)
    throw violation
  }

  log.debug(`Extracted ${fileCount} files (${totalBytes} bytes) from ${tarballPath}`)
}
