import { createAppAuth } from "@octokit/auth-app"
import { Octokit } from "@octokit/rest"
import crypto, { randomUUID } from "crypto"
import { Project, WorkTask } from "shared"

import { Database } from "../database"
import {
  GITHUB_APP_ID,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_PRIVATE_KEY,
  GITHUB_WEBHOOK_SECRET,
  APP_URL,
} from "../environment"
import { log } from "../log"
import { createScreenshotTest } from "../screenshotTests"
import type { DefaultRequest, DefaultResponse } from "../types"

// Extend the DefaultRequest type to include rawBody
interface WebhookRequest extends DefaultRequest {
  rawBody?: Buffer
}

/**
 * Verify the GitHub webhook signature
 */
function verifyWebhookSignature(
  payload: Buffer,
  signature: string | undefined,
  signingSecret: string,
): boolean {
  if (!signature) {
    return false
  }

  const pairs = signature.split(",").map((pair) => pair.trim().split("="))
  const sigMap = new Map(pairs as [string, string][])

  // Check for both signature types
  const sha1Sig = sigMap.get("sha1")
  const sha256Sig = sigMap.get("sha256")

  if (sha256Sig) {
    // Prefer SHA-256 if available
    const hmac = crypto.createHmac("sha256", signingSecret)
    const digest = hmac.update(payload).digest("hex")
    return crypto.timingSafeEqual(Buffer.from(sha256Sig), Buffer.from(digest))
  } else if (sha1Sig) {
    // Fallback to SHA-1
    const hmac = crypto.createHmac("sha1", signingSecret)
    const digest = hmac.update(payload).digest("hex")
    return crypto.timingSafeEqual(Buffer.from(sha1Sig), Buffer.from(digest))
  }

  return false
}

/**
 * Get an authenticated Octokit instance for a specific installation
 */
async function getOctokitForInstallation(installationId: number): Promise<Octokit> {
  const auth = createAppAuth({
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_PRIVATE_KEY,
    clientId: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
  })
  const installationAuth = await auth({ type: "installation", installationId })
  return new Octokit({ auth: installationAuth.token })
}

/**
 * Find a project by GitHub repository URL
 */
async function findProjectByRepo(
  repoOwner: string,
  repoName: string,
): Promise<Project | undefined> {
  const db = await Database()
  const projectRepo = db.getRepository(Project)

  // Look for projects with matching GitHub repository URL
  // URLs can be in forms like:
  // - https://github.com/owner/repo
  // - https://github.com/owner/repo.git
  const projects = await projectRepo.find()

  return projects.find((project) => {
    const url = project.githubRepoUrl.toLowerCase()
    const repoPattern = new RegExp(`github\\.com[/:]${repoOwner}/${repoName}(\\.git)?$`, "i")
    return repoPattern.test(url)
  })
}

/**
 * Handler for the check_suite webhook event
 */
export async function githubCheckSuiteWebhook(
  req: WebhookRequest,
  res: DefaultResponse,
): Promise<void> {
  // Get the raw body from Express
  const rawBody = req.rawBody

  if (!rawBody) {
    log.error("Missing request body")
    res.status(400).json({ error: "Missing request body" })
    return
  }

  // Verify webhook signature
  const signature = req.headers["x-hub-signature-256"] ?? req.headers["x-hub-signature"]
  const isValidSignature = verifyWebhookSignature(
    rawBody,
    typeof signature === "string" ? signature : undefined,
    GITHUB_WEBHOOK_SECRET,
  )

  if (!isValidSignature) {
    log.error("Invalid webhook signature")
    res.status(401).json({ error: "Invalid signature" })
    return
  }

  // Check for the GitHub event type
  const eventName = req.headers["x-github-event"]
  if (eventName !== "check_suite") {
    log.info(`Ignoring non-check_suite webhook event: ${eventName}`)
    res.status(202).json({ message: "Event ignored" })
    return
  }

  try {
    const payload = req.body as CheckSuitePayload
    const action = payload.action

    // Only process requested or rerequested actions
    if (action !== "requested" && action !== "rerequested") {
      log.info(`Ignoring check_suite action: ${action}`)
      res.status(202).json({ message: "Action ignored" })
      return
    }

    const headSha = payload.check_suite.head_sha
    const branch = payload.check_suite.head_branch || "unknown"
    const repoOwner = payload.repository.owner.login
    const repoName = payload.repository.name
    const installationId = payload.installation.id

    if (!headSha || !repoOwner || !repoName || !installationId) {
      log.error("Missing required webhook payload fields")
      res.status(400).json({ error: "Missing required payload fields" })
      return
    }

    log.info(
      `Processing check_suite ${action} event for ${repoOwner}/${repoName}@${headSha} (branch: ${branch})`,
    )

    // Find the project associated with this repository
    const project = await findProjectByRepo(repoOwner, repoName)
    if (!project) {
      log.error(`No project found for repository ${repoOwner}/${repoName}`)
      res.status(404).json({ error: "No project found for this repository" })
      return
    }

    // Create a unique upload ID for this test run
    const uploadId = randomUUID()

    // Create a screenshot test record
    const screenshotTest = await createScreenshotTest(project, headSha, branch, uploadId)

    // Create an Octokit instance for the installation
    const octokit = await getOctokitForInstallation(installationId)

    // Create an in-progress check run
    const checkRunResponse = await octokit.rest.checks.create({
      owner: repoOwner,
      repo: repoName,
      name: "UI Tests",
      head_sha: headSha,
      status: "in_progress",
      details_url: `${APP_URL}/build?id=${screenshotTest.id}`,
      output: {
        title: "UI Tests",
        summary: "Running visual regression tests...",
      },
    })

    const checkRunId = checkRunResponse.data.id

    // Create a task to process this screenshot test
    const task = new WorkTask()
    task.screenshotTest = screenshotTest
    task.taskType = "ingest_storybook"
    task.data = JSON.stringify({
      projectId: project.id,
      uploadId,
      githubCheckData: {
        owner: repoOwner,
        repo: repoName,
        checkRunId,
        installationId,
      },
    })
    task.createdAt = new Date()
    task.updatedAt = task.createdAt

    const db = await Database()
    const tasks = db.getRepository(WorkTask)
    const savedTask = await tasks.save(task)

    // Notify the worker of the new task
    await db.query(`NOTIFY task_queue, '${savedTask.id}'`)

    log.info(
      `Created check run ${checkRunId} and queued task for screenshot test ${screenshotTest.id}`,
    )

    res.status(200).json({
      message: "Check suite event processed successfully",
      checkRunId,
      testId: screenshotTest.id,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Error processing check_suite webhook: ${errorMessage}`)
    res.status(500).json({ error: "Internal server error" })
  }
}

interface CheckSuitePayload {
  action: string
  check_suite: {
    id: number
    head_branch: string
    head_sha: string
    status: string
    conclusion: string | null
    pull_requests: Array<{
      number: number
      head: {
        ref: string
        sha: string
        repo: {
          id: number
          name: string
        }
      }
      base: {
        ref: string
        sha: string
        repo: {
          id: number
          name: string
        }
      }
    }>
  }
  repository: {
    id: number
    name: string
    full_name: string
    owner: {
      login: string
      id: number
    }
  }
  organization?: {
    login: string
    id: number
  }
  sender: {
    login: string
    id: number
  }
  installation: {
    id: number
    node_id: string
  }
}
