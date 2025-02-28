import { S3Client } from "@aws-sdk/client-s3"
import { Upload as S3Upload } from "@aws-sdk/lib-storage"
import { WorkTask } from "shared"
import { uuidv7 } from "uuidv7"

import { getProjectByToken, getS3BucketForProject } from "../authenticate"
import { Database } from "../database"
import { getQueryString } from "../http"
import { log } from "../log"
import { createScreenshotTest } from "../screenshotTests"
import type { DefaultRequest, DefaultResponse } from "../types"

const MAX_UPLOAD_BYTES = 1024 * 1024 * 100 // 100 MB
const MAX_BRANCH_LENGTH = 1024

export async function uploadStorybook(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const length = parseInt(req.header("content-length") ?? "")
  if (!length || isNaN(length)) {
    throw new Error("Missing Content-Length header")
  }
  if (length > MAX_UPLOAD_BYTES) {
    throw new Error(`Upload too large: ${length} bytes (max ${MAX_UPLOAD_BYTES})`)
  }

  const token = getQueryString("token", req)
  if (!token) {
    throw new Error("Missing token")
  }

  const commitSha = req.header("x-vizdiff-commit-sha") ?? ""
  if (!isValidGitCommitHash(commitSha)) {
    throw new Error(`Invalid commit SHA: "${commitSha}"`)
  }

  const branch = req.header("x-vizdiff-branch") ?? ""
  if (!branch || branch.length > MAX_BRANCH_LENGTH) {
    throw new Error(`Invalid branch name: "${branch}"`)
  }

  const baseCommitSha = req.header("x-vizdiff-base-commit-sha")
  const baseBranch = req.header("x-vizdiff-base-branch")
  if (baseCommitSha || baseBranch) {
    if (!baseCommitSha) {
      throw new Error("Missing base commit SHA")
    }
    if (!baseBranch) {
      throw new Error("Missing base branch name")
    }

    if (!isValidGitCommitHash(baseCommitSha)) {
      throw new Error(`Invalid base commit SHA: "${baseCommitSha}"`)
    }
    if (baseBranch.length > MAX_BRANCH_LENGTH) {
      throw new Error(`Invalid base branch name: "${baseBranch}"`)
    }
  }

  const uploadId = uuidv7()
  const project = await getProjectByToken(token)
  if (!project) {
    res.status(401).json({ error: "Invalid token" })
    return
  }

  const Bucket = await getS3BucketForProject(project)
  const Key = `projects/${project.id}/${uploadId}.tar.gz`

  log.debug(
    `Uploading ${Key} to S3 bucket ${Bucket} (project=${project.id}, upload=${uploadId}, length=${length})`,
  )

  // Proxy the .tar.gz upload to S3
  const s3Client = new S3Client()
  const upload = new S3Upload({
    client: s3Client,
    params: {
      Bucket,
      Key,
      Body: req,
      ContentType: "application/gzip",
      ContentLength: length,
    },
  })

  try {
    const result = await upload.done()
    void result // Ignore the result
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    log.error(`Failed to upload ${Key} to S3: ${errorMessage}`)
    throw new Error(`Failed to upload to S3: ${errorMessage}`)
  }

  log.info(
    `Uploaded ${Key} to S3 bucket ${Bucket} (project=${project.id}, upload=${uploadId}, length=${length})`,
  )

  // Create a row in `screenshot_tests` for this upload
  const screenshotTest = await createScreenshotTest(
    project,
    commitSha,
    branch,
    uploadId,
    baseCommitSha,
    baseBranch,
  )

  // Add a task to the queue to process this screenshot test
  const task = new WorkTask()
  task.screenshotTest = screenshotTest
  task.taskType = "ingest_storybook"
  task.data = JSON.stringify({ projectId: project.id, uploadId })
  task.createdAt = new Date()
  task.updatedAt = task.createdAt

  const db = await Database()
  const tasks = db.getRepository(WorkTask)
  const savedTask = await tasks.save(task)

  // Use Postgres NOTIFY to wake up the worker
  await db.query(`NOTIFY task_queue, '${savedTask.id}'`)

  res.json({ success: true, uploadId, testId: screenshotTest.id })
}

function isValidGitCommitHash(hash: string): boolean {
  const regex = /^[0-9a-f]{40}$/i
  return regex.test(hash)
}
