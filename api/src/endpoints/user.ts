import { TRIAL_PERIOD_MS } from "src/environment"

import type { GitHubInstallationResponse, UserResponse } from "../apiTypes"
import { Database } from "../database"
import { getInstallationsForUserId } from "../github"
import { log } from "../log"
import type { GithubUser } from "../schemas/GithubUser"
import { deleteStripeCustomer } from "../stripe"
import type { RequestHandler } from "../types"

export const me: RequestHandler = async (_req, res) => {
  const { user } = res.locals
  const installations = await getInstallationsForUserId(user.id)

  const installationResponses: GitHubInstallationResponse[] = installations.map((installation) => ({
    id: installation.id,
    installationId: installation.installationId,
    accountId: installation.accountId,
    accountName: installation.accountName,
    accountType: installation.accountType,
    isCreator: installation.creatorId === user.id,
    createdStampSec: installation.createdAt.getTime() / 1000,
  }))

  const subscription =
    user.subscriptionPlan && user.subscriptionInterval
      ? { plan: user.subscriptionPlan, interval: user.subscriptionInterval }
      : null

  const trialEndStampSec = user.trialEndsAt?.getTime() ?? user.createdAt.getTime() + TRIAL_PERIOD_MS

  const response: UserResponse = {
    id: user.id,
    githubId: user.githubId,
    email: user.email,
    githubUsername: user.githubUsername,
    githubProfile: user.githubProfile as GithubUser,
    trialEndStampSec,
    createdStampSec: user.createdAt.getTime() / 1000,
    updatedStampSec: user.updatedAt.getTime() / 1000,
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
