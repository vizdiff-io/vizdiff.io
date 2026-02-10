import { S3Client } from "@aws-sdk/client-s3"
import { Upload as S3Upload } from "@aws-sdk/lib-storage"
import type { Logger } from "pino"
import { createSummaryForBuild, ScreenshotTest, User, WorkTask } from "shared"
import { uuidv7 } from "uuidv7"

import { getProjectByToken, getS3BucketForProject } from "../authenticate"
import { trackEvent } from "../customerio"
import { Database } from "../database"
import { APP_URL, ENABLE_VCS_STATUS, TRIAL_PERIOD_MS } from "../environment"
import { getInstallationForOrg, getOctokitForInstallation } from "../github"
import { type GitLabCheckData, updateGitLabCommitStatus } from "../gitlab"
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

  const logChild = log.child({
    userId: project.user.id,
    projectId: project.id,
    repo: project.repoUrl,
    vcsProvider: project.vcsProvider,
    uploadId,
    uploadLength: length,
    commitSha,
    branch,
    baseCommitSha,
    baseBranch,
    prNumber,
  })

  // Ensure the project owner has a valid subscription or trial
  const db = await Database()
  const userTable = db.getRepository(User)
  const projectOwner = await userTable.findOne({ where: { id: project.user.id } })
  if (!projectOwner) {
    throw new Error(`Project owner not found: ${project.user.id}`)
  }
  if (projectOwner.subscriptionPlan == null) {
    const owner = projectOwner.githubUsername
    if (projectOwner.trialEndsAt == null) {
      // This is an odd state since project creation should have started a trial, but we can start
      // their trial here.
      logChild.warn(
        { projectOwner },
        `No valid subscription or trial found for ${owner} during upload for project ${project.id}, starting trial`,
      )
      projectOwner.trialEndsAt = new Date(Date.now() + TRIAL_PERIOD_MS)
      await userTable.save(projectOwner)
    }

    if (projectOwner.trialEndsAt < new Date()) {
      // Return a 402 Payment Required error
      logChild.warn({ projectOwner }, `Storybook upload rejected, trial expired for "${owner}"`)
      res.status(402).json({
        error:
          `Free trial expired for "${owner}". Please subscribe at <https://vizdiff.io/signup> ` +
          `to continue uploading storybook builds.`,
      })
      return
    }
  }

  const Bucket = await getS3BucketForProject(project)
  const Key = `projects/${project.id}/${uploadId}.tar.gz`
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

  logChild.info(`Uploaded ${length} bytes to ${Bucket}/${Key} for ${project.repoUrl}#${commitSha}`)

  // Extract the owner and repo from the repository URL
  const [owner, repo] = project.repoUrl.split("/").slice(-2)
  if (!owner || !repo) {
    throw new Error(`Invalid repository URL: ${project.repoUrl}`)
  }

  // Create a row in `screenshot_tests` for this upload
  const screenshotTest = await createScreenshotTest({
    project,
    commitSha,
    branch,
    uploadId,
    baseCommitSha,
    baseBranch,
    prNumber,
  })

  // Create VCS status update based on provider
  let vcsStatusId: number | null = null
  let githubCheckData:
    | { owner: string; repo: string; checkRunId: number; installationId: number }
    | undefined
  let gitlabCheckData: GitLabCheckData | undefined

  if (project.vcsProvider === "github") {
    // Get the installation ID for this project
    const installation = await getInstallationForOrg(project.user.id, owner)
    if (!installation) {
      throw new Error(`GitHub App installation not found for ${owner}`)
    }

    // Create a GitHub check_run for this upload
    vcsStatusId = await createGitHubCheckRun({
      logChild,
      installationId: installation.installationId,
      owner,
      repo,
      commitSha,
      screenshotTest,
    })

    if (vcsStatusId) {
      githubCheckData = {
        owner,
        repo,
        checkRunId: vcsStatusId,
        installationId: installation.installationId,
      }
    }
  } else {
    // Create GitLab commit status for this upload
    const gitlabHost = projectOwner.gitlabHost ?? "https://gitlab.com"
    const accessToken = projectOwner.gitlabAccessToken

    if (accessToken && ENABLE_VCS_STATUS) {
      try {
        await updateGitLabCommitStatus(project.repoId, commitSha, "pending", {
          name: "vizdiff/visual-tests",
          targetUrl: `${APP_URL}/build?id=${screenshotTest.id}`,
          description: "Queued storybook upload for rendering",
          accessToken,
          host: gitlabHost,
        })
        // GitLab doesn't return an ID for commit statuses, use 1 as a flag
        vcsStatusId = 1
        // Store only non-sensitive data; worker resolves token from project owner at processing time
        gitlabCheckData = {
          projectId: project.repoId,
          commitSha,
          gitlabHost,
        }
        logChild.info(`Created GitLab commit status for ${project.repoUrl}#${commitSha}`)
      } catch (error) {
        logChild.error(error, `Failed to create GitLab commit status`)
        // Don't fail the upload if we can't create the commit status
      }
    } else if (!ENABLE_VCS_STATUS) {
      logChild.info(`Skipping GitLab commit status creation (ENABLE_VCS_STATUS not set)`)
    } else {
      logChild.warn(`No GitLab access token for user ${projectOwner.id}, skipping commit status`)
    }
  }

  // Update the screenshot test with the VCS status ID
  if (vcsStatusId != null) {
    screenshotTest.vcsStatusId = vcsStatusId
  }
  const screenshotTestTable = db.getRepository(ScreenshotTest)
  await screenshotTestTable.save(screenshotTest)

  // Add a task to the queue to process this screenshot test
  const task = new WorkTask()
  task.screenshotTest = screenshotTest
  task.taskType = "ingest_storybook"
  task.data = {
    projectId: project.id,
    uploadId,
    githubCheckData,
    gitlabCheckData,
  }
  task.createdAt = new Date()
  task.updatedAt = task.createdAt

  const tasks = db.getRepository(WorkTask)
  const savedTask = await tasks.save(task)

  // Use Postgres NOTIFY to wake up the worker
  await db.query(`NOTIFY task_queue, '${savedTask.id}'`)

  // Track the upload event with Customer.io. Since the upload is authenticated with a project token
  // there is no assumption that the uploader *is* the project owner, but it's still useful to track
  // these events and attribute them to the project owner
  trackEvent(project.user.id, req, "upload_storybook", {
    projectName: project.name,
    repo: project.repoUrl,
    buildId: screenshotTest.id,
    byteLength: length,
  })

  res.json({ success: true, uploadId, testId: screenshotTest.id })
}

interface GitHubCheckRunData {
  logChild: Logger
  installationId: number
  owner: string
  repo: string
  commitSha: string
  screenshotTest: ScreenshotTest
}

// Create a GitHub check_run for a new upload
async function createGitHubCheckRun({
  logChild,
  installationId,
  owner,
  repo,
  commitSha,
  screenshotTest,
}: GitHubCheckRunData): Promise<number | null> {
  if (!ENABLE_VCS_STATUS) {
    logChild.info(`Skipping GitHub check_run creation (ENABLE_VCS_STATUS not set)`)
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
