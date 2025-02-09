import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { WorkTask } from "shared"
import { uuidv7 } from "uuidv7"

import { getProjectByToken, getS3BucketForProject } from "../authenticate"
import { Database } from "../database"
import { getQueryString } from "../http"
import { log } from "../log"
import { createScreenshotTest } from "../screenshot_tests"
import type { DefaultRequest, DefaultResponse } from "../types"

const AWS_REGION = "us-east-1"
const MAX_UPLOAD_BYTES = 1024 * 1024 * 100 // 100 MB

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

  const branchName = req.header("x-vizdiff-branch-name") ?? ""
  if (!branchName || branchName.length > 255) {
    throw new Error(`Invalid branch name: "${branchName}"`)
  }

  const uploadId = uuidv7()
  const project = await getProjectByToken(token)

  const Bucket = await getS3BucketForProject(project)
  const Key = `projects/${project.id}/${uploadId}.tar.gz`

  log.debug(
    `Uploading ${Key} to S3 bucket ${Bucket} (project=${project.id}, upload=${uploadId}, length=${length})`,
  )

  // Proxy the .tar.gz upload to S3
  const s3Client = new S3Client({ region: AWS_REGION })
  const putObjectCommand = new PutObjectCommand({ Bucket, Key, Body: req })
  await s3Client.send(putObjectCommand)

  log.info(
    `Uploaded ${Key} to S3 bucket ${Bucket} (project=${project.id}, upload=${uploadId}, length=${req.readableLength})`,
  )

  // Create a row in `screenshot_tests` for this upload
  const screenshotTest = await createScreenshotTest(project.id, commitSha, branchName, uploadId)

  // Add a task to the queue to process this screenshot test
  const task = new WorkTask()
  task.screenshotTestId = screenshotTest.id
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
