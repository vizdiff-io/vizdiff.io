import crypto from "crypto"
import { createMarkdownForBuildApproval, Project, ScreenshotTest, TestResult } from "shared"

import { Database } from "../database"
import { APP_URL, GITHUB_WEBHOOK_SECRET, IS_PRODUCTION, IS_STAGING } from "../environment"
import { getOctokitForInstallation } from "../github"
import { log } from "../log"
import type { CheckRunPayload } from "../schemas/CheckRunPayload"
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

export async function githubWebhook(req: WebhookRequest, res: DefaultResponse): Promise<void> {
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
  if (eventName === "check_suite") {
    const payload = req.body as CheckSuitePayload
    if (payload.action === "requested" || payload.action === "rerequested") {
      await githubCheckSuiteRequested(res, payload)
    } else {
      log.info(`Ignoring GitHub check_suite action: "${payload.action}"`)
      res.status(202).json({ message: "Action ignored" })
    }
  } else if (eventName === "check_run") {
    const payload = req.body as CheckRunPayload
    if (payload.action === "requested_action") {
      await githubCheckRunRequestedAction(res, payload)
    } else {
      log.info(`Ignoring GitHub check_run action: "${payload.action}"`)
      res.status(202).json({ message: "Action ignored" })
    }
  } else {
    log.info(`Ignoring GitHub webhook event type: "${eventName}"`)
    res.status(202).json({ message: "Event ignored" })
    return
  }
}

async function githubCheckSuiteRequested(
  res: DefaultResponse,
  payload: CheckSuitePayload,
): Promise<void> {
  let subject = "(unknown)"
  try {
    const action = payload.action

    // Only process requested or rerequested_actions
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

    subject = `${repoOwner}/${repoName}#${headSha} (branch: ${branch})`
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

async function githubCheckRunRequestedAction(
  res: DefaultResponse,
  payload: CheckRunPayload,
): Promise<void> {
  const githubCheckRunId = payload.check_run.id

  // Extract the requested_action identifier
  const status = payload.requested_action?.identifier
  if (!status) {
    log.error("Missing requested_action identifier")
    res.status(400).json({ error: "Missing requested_action identifier" })
    return
  }

  // Extract the owner and repo from the repository full_name
  const [owner, repo] = payload.repository.full_name.split("/")
  if (!owner || !repo) {
    log.error(`Invalid repository full_name: ${payload.repository.full_name}`)
    res.status(400).json({ error: "Invalid repository full_name" })
    return
  }

  // Retrieve the test ID from the check_run payload
  const testId = Number(payload.check_run.external_id)
  if (!testId || isNaN(testId)) {
    log.error(`Missing or invalid test ID: "${payload.check_run.external_id}"`)
    res.status(400).json({ error: "Missing or invalid test ID" })
    return
  }

  // Validate the requested_action identifier
  if (status !== "approved" && status !== "denied") {
    log.error(`Invalid requested_action identifier: "${status}"`)
    res.status(400).json({ error: "Invalid requested_action identifier" })
    return
  }

  log.info(`GitHub check_run requested_action "${status}" for test ${testId}`)

  // Look up the screenshot test
  const db = await Database()
  const screenshotTestRepository = db.getRepository(ScreenshotTest)
  const test = await screenshotTestRepository.findOne({
    where: { id: testId },
  })

  if (!test) {
    log.error(`Screenshot test not found for ID: ${testId}`)
    res.status(400).json({ error: "Screenshot test not found" })
    return
  }

  if (test.status !== "unapproved") {
    log.error(`Cannot approve/deny screenshot test ${testId}, status is ${test.status}`)
    res.status(400).json({ error: "Screenshot test is not unapproved" })
    return
  }

  // Retrieve test results for this screenshot test
  const testResultTable = db.getRepository(TestResult)
  const testResults = await testResultTable.find({
    where: { screenshotTest: { id: test.id } },
  })

  // Update the screenshot test status
  test.status = status
  test.githubCheckRunId ??= githubCheckRunId
  await screenshotTestRepository.save(test)

  if (IS_PRODUCTION || IS_STAGING) {
    // Update GitHub check run
    const { title, summary, text } = createMarkdownForBuildApproval(
      test,
      testResults,
      payload.sender.login,
    )

    // Create a new check run with the success or failure conclusion
    const conclusion = status === "approved" ? "success" : "failure"
    const octokit = await getOctokitForInstallation(payload.installation.id)
    const result = await octokit.checks.create({
      owner,
      repo,
      head_sha: test.commitSha,
      external_id: String(test.id),
      name: "Visual Tests",
      status: "completed",
      conclusion,
      details_url: `${APP_URL}/build?id=${test.id}`,
      output: { title, summary, text },
    })
    log.info(
      `Created GitHub check run ${result.data.id} from webhook for ${test.toString()} with conclusion: ${conclusion}`,
    )
  }
}
