import { S3Client } from "@aws-sdk/client-s3"
import { Upload as S3Upload } from "@aws-sdk/lib-storage"
import type { Logger } from "pino"
import { createSummaryForBuild, ScreenshotTest, WorkTask } from "shared"
import { uuidv7 } from "uuidv7"

import { getProjectByToken, getS3BucketForProject } from "../authenticate"
import { Database } from "../database"
import { APP_URL, IS_PRODUCTION, IS_STAGING } from "../environment"
import { getInstallationForOrg, getOctokitForInstallation } from "../github"
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

  const pr = req.header("x-vizdiff-pr-number")
  const prNumber = pr ? parseInt(pr) : undefined
  if (prNumber != undefined && (isNaN(prNumber) || prNumber < 1)) {
    throw new Error(`Invalid pull request number: "${pr}"`)
  }

  const uploadId = uuidv7()
  const project = await getProjectByToken(token)
  if (!project) {
    res.status(401).json({ error: "Invalid token" })
    return
  }

  const Bucket = await getS3BucketForProject(project)
  const Key = `projects/${project.id}/${uploadId}.tar.gz`

  const logChild = log.child({
    userId: project.user.id,
    projectId: project.id,
    repo: project.githubRepoUrl,
    uploadId,
    uploadLength: length,
    commitSha,
    branch,
    baseCommitSha,
    baseBranch,
    prNumber,
  })
  logChild.debug(`Uploading ${length} bytes to ${Bucket}/${Key}`)

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
  } catch (error) {
    logChild.error(error, `Failed to upload ${Key} to S3`)
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to upload to S3: ${msg}`)
  }

  logChild.info(
    `Uploaded ${length} bytes to ${Bucket}/${Key} for ${project.githubRepoUrl}#${commitSha}`,
  )

  // Extract the GitHub owner and repo from the GitHub repository URL
  const [owner, repo] = project.githubRepoUrl.split("/").slice(-2)
  if (!owner || !repo) {
    throw new Error(`Invalid GitHub repository URL: ${project.githubRepoUrl}`)
  }

  // Get the installation ID for this project
  const installation = await getInstallationForOrg(project.user.id, owner)
  if (!installation) {
    throw new Error(`GitHub App installation not found for ${owner}`)
  }

  // Create a row in `screenshot_tests` for this upload
  const screenshotTest = await createScreenshotTest(
    project,
    commitSha,
    branch,
    uploadId,
    baseCommitSha,
    baseBranch,
    prNumber,
  )

  // Create a GitHub check_run for this upload
  const githubCheckRunId = await createGitHubCheckRun(
    logChild,
    installation.installationId,
    owner,
    repo,
    commitSha,
    screenshotTest,
  )

  const db = await Database()

  // Update the screenshot test with the GitHub check_run ID
  screenshotTest.githubCheckRunId = githubCheckRunId
  const screenshotTestTable = db.getRepository(ScreenshotTest)
  await screenshotTestTable.save(screenshotTest)

  // Add a task to the queue to process this screenshot test
  const task = new WorkTask()
  task.screenshotTest = screenshotTest
  task.taskType = "ingest_storybook"
  task.data = {
    projectId: project.id,
    uploadId,
    githubCheckData: githubCheckRunId
      ? {
          owner,
          repo,
          checkRunId: githubCheckRunId,
          installationId: installation.installationId,
        }
      : undefined,
  }
  task.createdAt = new Date()
  task.updatedAt = task.createdAt

  const tasks = db.getRepository(WorkTask)
  const savedTask = await tasks.save(task)

  // Use Postgres NOTIFY to wake up the worker
  await db.query(`NOTIFY task_queue, '${savedTask.id}'`)

  res.json({ success: true, uploadId, testId: screenshotTest.id })
}

// Create a GitHub check_run for a new upload
async function createGitHubCheckRun(
  logChild: Logger,
  installationId: number,
  owner: string,
  repo: string,
  commitSha: string,
  screenshotTest: ScreenshotTest,
): Promise<number | null> {
  if (!IS_PRODUCTION && !IS_STAGING) {
    logChild.info(`Skipping GitHub check_run creation in development environment`)
    return null
  }

  const screenshotTestId = screenshotTest.id
  const octokit = await getOctokitForInstallation(installationId)
  logChild.info({ screenshotTestId }, `Creating new GitHub check_run`)
  const checkRunResponse = await octokit.rest.checks.create({
    owner,
    repo,
    head_sha: commitSha,
    name: "Visual Tests",
    status: "queued",
    details_url: `${APP_URL}/build?id=${screenshotTestId}`,
    output: {
      title: "Queued storybook upload for rendering",
      summary: createSummaryForBuild(screenshotTest),
    },
  })
  const githubCheckRunId = checkRunResponse.data.id
  logChild.info({ screenshotTestId, githubCheckRunId }, `Created new GitHub check_run`)
  return githubCheckRunId
}

function isValidGitCommitHash(hash: string): boolean {
  const regex = /^[0-9a-f]{40}$/i
  return regex.test(hash)
}
