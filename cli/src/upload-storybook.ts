import { COMPRESSION_LEVEL, tar } from "zip-a-folder"
import { fetch } from "undici"
import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import { info } from "./log"

/**
 * Packages a storybook build folder and uploads it to the vizdiff CDN.
 */
export async function uploadStorybook(storybookDir: string, projectToken: string): Promise<void> {
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
    project = JSON.parse(json)
  } catch (error) {
    throw new Error(`Failed to parse project.json file: ${error}`)
  }

  // Check that the build manifest is valid
  if (!project || typeof project.storybookVersion !== "string") {
    throw new Error(`Invalid project.json file: ${projectJsonPath}`)
  }

  // Create a tarball of the storybook build folder
  const tarballFilename = path.join(os.tmpdir(), `${projectToken}.tar.gz`)
  const error = await tar(storybookDir, tarballFilename, { compression: COMPRESSION_LEVEL.medium })
  if (error) {
    throw new Error(`Failed to tar+gzip storybook build folder: ${error}`)
  }
  info(`Created storybook tarball: ${tarballFilename}`)

  // POST the tarball to the vizdiff API
  const url = `https://vizdiff.io/api/v1/upload-storybook?token=${projectToken}`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/gzip",
    },
    body: await fs.readFile(tarballFilename),
  })
  if (!response.ok) {
    throw new Error(
      `Failed to upload storybook build folder to vizdiff CDN: ${response.statusText} (${response.status})`,
    )
  }
  info(`Uploaded storybook build folder:`)

  // Delete the tarball
  await fs.unlink(tarballFilename)
}
