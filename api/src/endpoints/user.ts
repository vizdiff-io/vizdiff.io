import { Octokit } from "@octokit/rest"
import { UserGithubRepoAccess } from "shared"

import type { GitHubInstallationResponse, UserResponse } from "../apiTypes"
import { toSeconds } from "../conversions"
import { Database } from "../database"
import { GITHUB_APP_ID, TRIAL_PERIOD_MS } from "../environment"
import { getInstallationsForUserId, getOctokitForInstallation } from "../github"
import { log } from "../log"
import type { GithubUser } from "../schemas/GithubUser"
import { deleteStripeCustomer } from "../stripe"
import type { RequestHandler } from "../types"

export const me: RequestHandler = async (_req, res) => {
  const { user, ownedProjectCount } = res.locals
  const installations = await getInstallationsForUserId(user.id)

  const installationResponses: GitHubInstallationResponse[] = installations.map((installation) => ({
    id: installation.id,
    installationId: installation.installationId,
    accountId: installation.accountId,
    accountName: installation.accountName,
    accountType: installation.accountType,
    isCreator: installation.creatorId === user.id,
    createdStampSec: toSeconds(installation.createdAt),
  }))

  const subscription =
    user.subscriptionPlan && user.subscriptionInterval
      ? { plan: user.subscriptionPlan, interval: user.subscriptionInterval }
      : null

  const trialEndStampSec = toSeconds(
    user.trialEndsAt ?? new Date(user.createdAt.getTime() + TRIAL_PERIOD_MS),
  )

  const response: UserResponse = {
    id: user.id,
    githubId: user.githubId,
    email: user.email,
    githubUsername: user.githubUsername,
    githubProfile: user.githubProfile as GithubUser,
    ownedProjectCount,
    trialEndStampSec,
    createdStampSec: toSeconds(user.createdAt),
    updatedStampSec: toSeconds(user.updatedAt),
    githubInstallations: installationResponses,
    subscription,
  }
  res.json(response)
}

export const deleteAccount: RequestHandler = async (_req, res) => {
  const { user } = res.locals

  // Don't allow deleting the account if there is an active subscription
  if (user.stripeSubscriptionId) {
    log.error(
      { user },
      `Cannot delete an account ${user.id} (${user.email}) with an active subscription`,
    )
    res.status(400).json({
      error:
        "Cannot delete an account with an active subscription. If you want to delete before your " +
        "subscription has ended, please email contact@vizdiff.io",
    })
    return
  }

  log.warn({ user }, `Deleting account for user ${user.id} (${user.email})`)

  // Delete the Stripe customer, if one exists
  if (user.stripeCustomerId) {
    await deleteStripeCustomer(user.stripeCustomerId)
  }

  try {
    const db = await Database()
    await db.transaction(async (manager) => {
      await manager.remove(user)
    })

    res.clearCookie("token")
    res.clearCookie("authenticated")

    log.info({ user }, `Account deleted for user ${user.id} (${user.email})`)
    res.status(200).json({ success: true, message: "Account deleted successfully" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    log.error(error, `Failed to delete account for user ${user.id} (${user.email})`)
    res.status(500).json({ error: "Failed to delete account", message })
  }
}

export const syncGithubRepos: RequestHandler = async (_req, res) => {
  const { user } = res.locals
  const db = await Database()

  try {
    log.debug({ user }, `Starting GitHub repo sync for user ${user.id} (${user.githubUsername})`)
    const userOctokit = new Octokit({ auth: user.githubAccessToken })

    // 1. List installations accessible by the user for our app
    const installationsResponse = await userOctokit.apps.listInstallationsForAuthenticatedUser()
    const ourInstallations = installationsResponse.data.installations.filter(
      (inst) => inst.app_id === parseInt(GITHUB_APP_ID, 10) && inst.account != null,
    )

    if (ourInstallations.length === 0) {
      log.info(
        { user },
        `User ${user.id} (${user.githubUsername}) has no installations of our GitHub App. Clearing access cache.`,
      )
      // Clear existing access if no installations are found
      await db.manager.delete(UserGithubRepoAccess, { userId: user.id })
      res.status(200).json({ message: "No GitHub App installations found.", count: 0 })
      return
    }

    const installationIds = ourInstallations.map((i) => i.id)
    log.debug(
      { user, installationIds },
      `User ${user.id} (${user.githubUsername}) has access to ${installationIds.length} installation(s)`,
    )

    // 2. Collect all unique repo IDs accessible via these installations
    const accessibleRepoIds = new Set<number>()
    for (const installation of ourInstallations) {
      try {
        // Check if installation object has an id property
        if (typeof installation.id !== "number") {
          log.warn(
            { user, installation },
            `Skipping installation "${installation.id}" without a valid ID during sync for user ${user.id}`,
          )
          continue // Skip this installation
        }
        const installationId = installation.id

        log.debug(`Fetching repos for installation ${installationId}`)
        const installationOctokit = await getOctokitForInstallation(installationId)
        // Use iteratePaginate for automatic pagination handling
        const repoIterator = installationOctokit.paginate.iterator(
          installationOctokit.apps.listReposAccessibleToInstallation,
        )

        let countForInstallation = 0
        for await (const { data: repos } of repoIterator) {
          for (const repo of repos) {
            if (repo.id) {
              // Ensure repo ID exists
              accessibleRepoIds.add(repo.id)
              countForInstallation++
            } else {
              log.warn(
                { installationId },
                `Found repo without ID for installation ${installationId}: ${repo.name}`,
              )
            }
          }
        }
        log.debug(
          `Installation ${installationId}: Found ${countForInstallation} repos. Total unique repos so far: ${accessibleRepoIds.size}`,
        )
      } catch (error) {
        log.error(
          error,
          `Failed to list repositories for installation ${installation.id} during sync for user ${user.id} (${user.githubUsername})`,
        )
        // Continue with other installations
      }
    }

    log.info(
      { user, installationIds, repoCount: accessibleRepoIds.size },
      `User ${user.id} (${user.githubUsername}) sync: Found total ${accessibleRepoIds.size} accessible repositories via GitHub App installations.`,
    )

    // 3. Atomically update UserGithubRepoAccess table
    await db.manager.transaction(async (transactionalEntityManager) => {
      // Delete old records
      const deleteResult = await transactionalEntityManager.delete(UserGithubRepoAccess, {
        userId: user.id,
      })
      log.debug(
        `Deleted ${deleteResult.affected ?? 0} existing UserGithubRepoAccess records for user ${user.id} (${user.githubUsername})`,
      )

      // Insert new records if any repos were found
      if (accessibleRepoIds.size > 0) {
        const newAccessRecords = Array.from(accessibleRepoIds).map((repoId) => ({
          userId: user.id,
          githubRepoId: repoId,
        }))

        // Use save which handles bulk inserts efficiently
        await transactionalEntityManager.save(UserGithubRepoAccess, newAccessRecords, {
          chunk: 200, // Process in chunks for large numbers of repos
        })
        log.debug(
          `Inserted ${newAccessRecords.length} UserGithubRepoAccess records for user ${user.id} (${user.githubUsername})`,
        )
      }
    })

    log.info(`Successfully completed GitHub repo sync for user ${user.id} (${user.githubUsername})`)
    res.status(200).json({
      message: "GitHub repository access synchronized successfully.",
      count: accessibleRepoIds.size,
    })
  } catch (error) {
    log.error(error, `GitHub repo sync failed for user ${user.id} (${user.githubUsername})`)
    if (error instanceof Error) {
      res.status(500).json({ error: `Sync failed: ${error.message}` })
    } else {
      res.status(500).json({ error: "An unknown error occurred during synchronization." })
    }
  }
}
