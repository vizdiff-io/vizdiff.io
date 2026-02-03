import type { GitHubInstallationResponse, GitLabGroupResponse, UserResponse } from "../apiTypes"
import { toSeconds } from "../conversions"
import { trackEvent } from "../customerio"
import { Database } from "../database"
import { TRIAL_PERIOD_MS } from "../environment"
import { getInstallationsForUserId, syncUserGithubRepos } from "../github"
import { getGitLabGroupsForUserId, syncUserGitLabProjects } from "../gitlab"
import { log } from "../log"
import type { GithubUser, GitlabUser } from "../schemas/GithubUser"
import { deleteStripeCustomer } from "../stripe"
import type { RequestHandler } from "../types"

export const me: RequestHandler = async (_req, res) => {
  const { user, ownedProjectCount } = res.locals

  // Get GitHub installations
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

  // Get GitLab groups
  const gitlabGroups = await getGitLabGroupsForUserId(user.id)
  const gitlabGroupResponses: GitLabGroupResponse[] = gitlabGroups.map((group) => ({
    id: group.id,
    gitlabGroupId: group.gitlabGroupId,
    groupPath: group.groupPath,
    groupName: group.groupName,
    fullPath: group.fullPath,
    gitlabHost: group.gitlabHost,
    avatarUrl: group.avatarUrl,
    webUrl: group.webUrl,
    createdStampSec: toSeconds(group.createdAt),
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
    // GitHub info (may be null for GitLab-only users)
    githubId: user.githubId,
    githubUsername: user.githubUsername,
    githubProfile: user.githubProfile as GithubUser | null,
    githubInstallations: installationResponses,
    // GitLab info (may be null for GitHub-only users)
    gitlabId: user.gitlabId,
    gitlabUsername: user.gitlabUsername,
    gitlabProfile: user.gitlabProfile as GitlabUser | null,
    gitlabHost: user.gitlabHost,
    gitlabGroups: gitlabGroupResponses,
    // Common fields
    email: user.email,
    ownedProjectCount,
    trialEndStampSec,
    createdStampSec: toSeconds(user.createdAt),
    updatedStampSec: toSeconds(user.updatedAt),
    subscription,
  }
  res.json(response)
}

export const deleteAccount: RequestHandler = async (req, res) => {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    log.error(error, `Failed to delete account for user ${user.id} (${user.email})`)
    res.status(500).json({ error: "Failed to delete account", message })
    return
  }

  res.clearCookie("token")
  res.clearCookie("authenticated")

  log.info({ user }, `Account deleted for user ${user.id} (${user.email})`)

  // Track the account deletion event with Customer.io
  trackEvent(user.id, req, "account_deleted", { email: user.email })

  res.status(200).json({ success: true, message: "Account deleted successfully" })
}

export const syncGithubRepos: RequestHandler = async (req, res) => {
  const { user } = res.locals

  if (!user.githubAccessToken) {
    res.status(400).json({ error: "GitHub account not connected" })
    return
  }

  try {
    const repoCount = await syncUserGithubRepos(user)

    // Track the GitHub repo sync event with Customer.io
    trackEvent(user.id, req, "github_repo_synced", { count: repoCount })

    res.status(200).json({
      message: "GitHub repository access synchronized successfully.",
      count: repoCount,
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

export const syncGitlabProjects: RequestHandler = async (req, res) => {
  const { user } = res.locals

  if (!user.gitlabAccessToken) {
    res.status(400).json({ error: "GitLab account not connected" })
    return
  }

  try {
    const projectCount = await syncUserGitLabProjects(user)

    // Track the GitLab project sync event with Customer.io
    trackEvent(user.id, req, "gitlab_project_synced", { count: projectCount })

    res.status(200).json({
      message: "GitLab project access synchronized successfully.",
      count: projectCount,
    })
  } catch (error) {
    log.error(error, `GitLab project sync failed for user ${user.id} (${user.gitlabUsername})`)
    if (error instanceof Error) {
      res.status(500).json({ error: `Sync failed: ${error.message}` })
    } else {
      res.status(500).json({ error: "An unknown error occurred during synchronization." })
    }
  }
}
