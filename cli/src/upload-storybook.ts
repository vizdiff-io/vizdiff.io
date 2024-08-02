import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import { fetch } from "undici"
import { COMPRESSION_LEVEL, tar } from "zip-a-folder"

import { info } from "./log"

export type UploadStorybookOpts = {
  storybookDir: string
  commitSha: string
  branchName: string
  projectToken: string
}

type UploadResponse = { success: boolean; testId?: string; uploadId?: string; error?: string }

/**
 * Packages a storybook build folder and uploads it to the vizdiff CDN.
 */
export async function uploadStorybook(opts: UploadStorybookOpts): Promise<void> {
  const { storybookDir, commitSha, branchName, projectToken } = opts

  // Sanity check input params
  if (!isValidGitCommitHash(commitSha)) {
    throw new Error(`Invalid commit SHA: "${commitSha}"`)
  }
  if (!branchName || branchName.length > 255) {
    throw new Error(`Invalid branch name: "${branchName}"`)
  }

  // Check that the storybook build manifest exists
  const projectJsonPath = path.join(storybookDir, "project.json")
  try {
    await fs.access(projectJsonPath, fs.constants.R_OK)
  } catch (error) {
    throw new Error(`Storybook build manifest does not exist: ${projectJsonPath}`)
  }

  // Read and parse the build manifest
  let project: Record<string, unknown> | undefined
  try {
    const json = await fs.readFile(projectJsonPath, "utf8")
    project = JSON.parse(json) as Record<string, unknown>
  } catch (error) {
    throw new Error(`Failed to parse project.json file: ${error}`)
  }

  // Check that the build manifest is valid
  if (!project || typeof project.storybookVersion !== "string") {
    throw new Error(`Invalid project.json file: ${projectJsonPath}`)
  }

  // Create a tarball of the storybook build folder
  const tarballFilename = path.join(os.tmpdir(), `${randHexString()}.tar.gz`)
  const error = await tar(storybookDir, tarballFilename, { compression: COMPRESSION_LEVEL.medium })
  if (error) {
    throw new Error(`Failed to tar+gzip storybook build folder: ${error}`)
  }
  info(`Created storybook tarball: ${tarballFilename}`)

  // POST the tarball to the vizdiff API
  const body = await fs.readFile(tarballFilename)
  const baseUrl = (process.env.VIZDIFF_API_URL ?? "https://vizdiff.io").replace(/\/+$/, "")
  const url = `${baseUrl}/api/upload/storybook?token=${projectToken}`
  info(
    `Uploading ${formatBytes(
      body.byteLength,
    )} for commit ${commitSha} on branch ${branchName} to ${baseUrl}`,
  )
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/gzip",
      "X-Vizdiff-Commit-Sha": commitSha,
      "X-Vizdiff-Branch-Name": branchName,
    },
    body: await fs.readFile(tarballFilename),
  })
  if (!response.ok) {
    throw new Error(
      `Failed to upload storybook build folder to vizdiff CDN: ${response.statusText} (${response.status})`,
    )
  }
  const res = (await response.json()) as UploadResponse
  if (!res.success) {
    throw new Error(
      `Failed to upload storybook build folder to vizdiff CDN: ${JSON.stringify(res.error ?? res)}`,
    )
  }
  info(`Uploaded storybook build folder, testId=${res.testId}, uploadId=${res.uploadId}`)

  // Delete the tarball
  await fs.unlink(tarballFilename)
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
