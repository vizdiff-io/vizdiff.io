import { Analytics as CustomerIoAnalytics } from "@customerio/cdp-analytics-node"
import { TestResult, ScreenshotTest, Project, UserGithubRepoAccess } from "shared"

import { Database } from "./database"
import { CUSTOMER_IO_API_KEY } from "./environment"
import { log } from "./log"

let gCustomerIo: CustomerIoAnalytics | undefined

// Lazily initialize the Customer.io client
function getCustomerIo(): CustomerIoAnalytics | undefined {
  if (!CUSTOMER_IO_API_KEY) {
    return undefined
  }

  if (!gCustomerIo) {
    gCustomerIo = new CustomerIoAnalytics({ writeKey: CUSTOMER_IO_API_KEY })
  }
  return gCustomerIo
}

export function reportBuildEvents(screenshotTest: ScreenshotTest, _results: TestResult[]): void {
  void (async () => {
    try {
      // Look up all users who have access to the project
      const db = await Database()
      const userIds = await getUserIdsForProject(db, screenshotTest.project)

      const properties = {
        // Project details
        projectId: screenshotTest.project.id,
        projectName: screenshotTest.project.name,
        repo: screenshotTest.project.githubRepoUrl,

        // Build details
        buildNumber: screenshotTest.buildNumber,
        buildDurationSec: screenshotTest.buildDurationSec,
        commitSha: screenshotTest.commitSha,
        branch: screenshotTest.branch,
        baseCommitSha: screenshotTest.baseCommitSha,
        baseBranch: screenshotTest.baseBranch,
        prNumber: screenshotTest.prNumber,
        uploadId: screenshotTest.uploadId,
        status: screenshotTest.status,
        tag: screenshotTest.tag,
        totalChanges: screenshotTest.totalChanges,
        browserVersion: screenshotTest.browserVersion,
      }

      const customerIo = getCustomerIo()
      if (!customerIo) {
        log.info("CUSTOMER_IO_API_KEY is not set, skipping event tracking")
        return
      }

      // Report the event to Customer.io for each user
      for (const userId of userIds) {
        doTrackEvent(customerIo, userId, "build_completed", properties)
      }
    } catch (err) {
      log.error(err, `Failed to report build events for ${screenshotTest.id} to Customer.io`)
    }
  })()
}

/**
 * Track an event with an instantiated Customer.io client.
 * @param userId The user ID to track the event for
 * @param event The event name to track
 * @param properties Additional custom properties to track with the event
 */
function doTrackEvent(
  customerIo: CustomerIoAnalytics,
  userId: number,
  event: string,
  properties: Record<string, unknown>,
): void {
  try {
    customerIo.track({ userId: userId.toString(), event, properties }, (err) => {
      if (err) {
        log.error(
          { err, userId },
          `Failed to track event ${event} for user ${userId} with Customer.io`,
        )
      }
    })
  } catch (err) {
    log.error({ err, userId }, `Failed to track event ${event} for user ${userId} with Customer.io`)
  }
}

/**
 * Get all user IDs that have access to a given project ID.
 * Access can be direct ownership or through associated GitHub repository access.
 * @param db TypeORM database connection
 * @param project The project to check access for
 * @returns Array of unique user IDs that have access to the project
 */
async function getUserIdsForProject(
  db: Awaited<ReturnType<typeof Database>>,
  project: Project,
): Promise<number[]> {
  const accessRepo = db.getRepository(UserGithubRepoAccess)
  const allUserIds = new Set<number>()

  // Add the project owner
  allUserIds.add(project.user.id)

  // Find users with access via GitHub repo
  const githubAccessUsers = await accessRepo
    .createQueryBuilder("access")
    .select("access.userId", "userId")
    .where("access.githubRepoId = :githubRepoId", { githubRepoId: project.githubRepoId })
    .getRawMany<{ userId: number }>()

  githubAccessUsers.forEach((user) => {
    allUserIds.add(user.userId)
  })

  return Array.from(allUserIds)
}
