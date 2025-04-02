import crypto from "crypto"
import { Project, ScreenshotTest } from "shared"

import { Database } from "../database"
import { GITHUB_WEBHOOK_SECRET } from "../environment"
import { log } from "../log"
import type { CheckSuitePayload } from "../schemas/CheckSuitePayload"
import type { DefaultRequest, DefaultResponse } from "../types"

// Extend the DefaultRequest type to include rawBody
interface WebhookRequest extends DefaultRequest {
  rawBody?: Buffer
}

/**
 * Verify the GitHub webhook signature
 */
export function verifyWebhookSignature(
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
    log.debug(`Ignoring non-check_suite webhook event: ${eventName}`)
    res.status(202).json({ message: "Event ignored" })
    return
  }

  let subject = "(unknown)"
  try {
    const payload = req.body as CheckSuitePayload
    const action = payload.action

    // Only process requested or rerequested actions
    if (action !== "requested" && action !== "rerequested") {
      log.debug(`Ignoring check_suite action: ${action}`)
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

    subject = `${repoOwner}/${repoName}@${headSha} (branch: ${branch})`
    log.info(`Processing check_suite "${action}" event for ${subject}`)

    // Find the project associated with this repository
    const project = await findProjectByRepo(repoOwner, repoName)
    if (!project) {
      log.error(`No project found for ${subject}`)
      res.status(404).json({ error: "No project found for this repository" })
      return
    }

    // Check if a screenshot test already exists for this commit SHA
    const db = await Database()
    const screenshotTestRepository = db.getRepository(ScreenshotTest)
    const existingTest = await screenshotTestRepository.findOne({
      where: {
        commitSha: headSha,
        project: { id: project.id },
      },
    })

    if (existingTest?.status === "failed") {
      // TASK: Queue a worker task to re-run the screenshot test
      log.warn(`TODO: Re-run screenshot test after failure for ${subject}`)
    } else if (action === "rerequested") {
      log.warn(
        `GitHub check_suite re-requested for ${subject}, current status: ${existingTest?.status ?? "(none)"}`,
      )
    } else {
      // This is the normal case, a check_suite webhook comes in before the storybook upload
      log.info(`GitHub check_suite (action=${action}) received for ${subject}`)
    }

    res.status(200).json({
      message: "Check suite event processed successfully",
    })
  } catch (error) {
    log.error(error, `Error processing check_suite webhook for ${subject}`)
    res.status(500).json({ error: "Internal server error" })
  }
}
