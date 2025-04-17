import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import { fetch } from "undici"
import { COMPRESSION_LEVEL, tar } from "zip-a-folder"

import { info } from "./log"

export type UploadStorybookOpts = {
  storybookDir: string
  commitSha: string
  branch: string
  projectToken: string
  baseCommitSha?: string
  baseBranch?: string
  prNumber?: number
}

type UploadResponse = { success: boolean; testId?: string; uploadId?: string; error?: string }

/**
 * Packages a storybook build folder and uploads it to the vizdiff CDN.
 */
export async function uploadStorybook(opts: UploadStorybookOpts): Promise<void> {
  const { storybookDir, commitSha, branch, projectToken, baseCommitSha, baseBranch, prNumber } =
    opts

  // Sanity check input params
  if (!isValidGitCommitHash(commitSha)) {
    throw new Error(`Invalid commit SHA: "${commitSha}"`)
  }
  if (!branch || branch.length > 255) {
    throw new Error(`Invalid branch name: "${branch}"`)
  }

  // Check that the storybook build manifest exists
  const projectJsonPath = path.resolve(storybookDir, "project.json")
  try {
    await fs.access(projectJsonPath, fs.constants.R_OK)
  } catch (err: unknown) {
    void err
    throw new Error(`Storybook build manifest does not exist: ${projectJsonPath}`)
  }

  // Read and parse the build manifest
  let project: Record<string, unknown> | undefined | null
  try {
    const json = await fs.readFile(projectJsonPath, "utf8")
    project = JSON.parse(json) as Record<string, unknown> | null
  } catch (error) {
    throw new Error(`Failed to parse project.json file: ${error}`)
  }

  // Check that the build manifest is valid
  if (!project || typeof project.storybookVersion !== "string") {
    throw new Error(`Invalid project.json file: ${projectJsonPath}`)
  }

  // Read and parse the index.json file
  const indexJsonPath = path.resolve(storybookDir, "index.json")
  let index: Record<string, unknown> | undefined | null
  try {
    const json = await fs.readFile(indexJsonPath, "utf8")
    index = JSON.parse(json) as Record<string, unknown> | null
  } catch (error) {
    throw new Error(`Failed to parse index.json file: ${error}`)
  }

  // Count the number of stories in the index.json file
  const storyCount =
    index?.entries && typeof index.entries === "object" ? Object.keys(index.entries).length : 0
  if (storyCount === 0) {
    throw new Error(`No stories found in index.json file: ${indexJsonPath}`)
  }
  info(`Found ${storyCount} ${storyCount === 1 ? "story" : "stories"}`)

  // Create a tarball of the storybook build folder
  const tarballFilename = path.join(os.tmpdir(), `${randHexString()}.tar.gz`)
  const error = await tar(storybookDir, tarballFilename, { compression: COMPRESSION_LEVEL.medium })
  if (error) {
    throw new Error(`Failed to tar+gzip storybook build folder: ${error}`)
  }
  info(`Created storybook tarball: ${tarballFilename}`)

  try {
    // POST the tarball to the vizdiff API
    const body = await fs.readFile(tarballFilename)
    const baseUrl = (process.env.VIZDIFF_API_URL ?? "https://vizdiff.io/api").replace(/\/+$/, "")
    const url = `${baseUrl}/upload/storybook?token=${projectToken}`
    const baseCommitStr =
      baseCommitSha || baseBranch
        ? `base commit ${baseCommitSha ?? ""} on branch "${baseBranch ?? ""}"`
        : "no base commit"
    const pullRequestStr = prNumber ? ` pull request #${prNumber}` : ""
    info(
      `Uploading ${formatBytes(body.byteLength)} for commit ${commitSha} ` +
        `on branch "${branch}" (${baseCommitStr})${pullRequestStr} to ` +
        (baseUrl.includes("//vizdiff.io") ? "vizdiff.io" : baseUrl),
    )
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/gzip",
        "X-Vizdiff-Commit-Sha": commitSha,
        "X-Vizdiff-Branch": branch,
        ...(baseCommitSha && { "X-Vizdiff-Base-Commit-Sha": baseCommitSha }),
        ...(baseBranch && { "X-Vizdiff-Base-Branch": baseBranch }),
        ...(prNumber && { "X-Vizdiff-PR-Number": prNumber.toString() }),
      },
      body: await fs.readFile(tarballFilename),
    })
    if (!response.ok) {
      let errorJson: unknown
      let errorString: string | undefined =
        `Failed to upload storybook build folder to vizdiff CDN: ${response.statusText} (${response.status})`
      try {
        if (response.headers.get("content-type")?.includes("application/json")) {
          errorJson = await response.json()
          if (
            errorJson &&
            typeof errorJson === "object" &&
            "error" in errorJson &&
            typeof (errorJson as Record<string, unknown>).error === "string"
          ) {
            errorString = (errorJson as { error: string }).error
          }
        }
      } catch {
        // ignore JSON parse errors
      }
      const uploadError = new Error(errorString) as Error & { statusCode?: number }
      uploadError.statusCode = response.status
      throw uploadError
    }
    const res = (await response.json()) as UploadResponse
    if (!res.success) {
      throw new Error(
        `Failed to upload storybook build folder to vizdiff CDN: ${res.error ?? "Unknown error"}`,
      )
    }
    info(`Uploaded storybook build folder, testId=${res.testId}, uploadId=${res.uploadId}`)
  } finally {
    // Delete the tarball regardless of success or failure
    await fs.unlink(tarballFilename)
    info(`Deleted storybook tarball: ${tarballFilename}`)
  }
}

function randHexString(length = 8): string {
  return [...Array<undefined>(length)]
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join("")
}

function isValidGitCommitHash(hash: string): boolean {
  const regex = /^[0-9a-f]{40}$/i
  return regex.test(hash)
}

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) {
    return "0 Bytes"
  }

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(dm))
  return `${size} ${sizes[i]}`
}
