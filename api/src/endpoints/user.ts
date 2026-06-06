import type { GitHubInstallationResponse, UserResponse } from "../apiTypes"
import { toSeconds } from "../conversions"
import { Database } from "../database"
import { GITHUB_ENABLED } from "../environment"
import { getInstallationsForUserId } from "../github"
import { log } from "../log"
import type { GithubUser } from "../schemas/GithubUser"
import type { RequestHandler } from "../types"

export const me: RequestHandler = async (_req, res) => {
  const { user, ownedProjectCount } = res.locals

  // GitHub installations (only when GitHub support is enabled).
  let installationResponses: GitHubInstallationResponse[] = []
  if (GITHUB_ENABLED) {
    const installations = await getInstallationsForUserId(user.id)
    installationResponses = installations.map((installation) => ({
      id: installation.id,
      installationId: installation.installationId,
      accountId: installation.accountId,
      accountName: installation.accountName,
      accountType: installation.accountType,
      isCreator: installation.creatorId === user.id,
      createdStampSec: toSeconds(installation.createdAt),
    }))
  }

  const response: UserResponse = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    authProvider: user.authProvider,
    githubId: user.githubId,
    githubUsername: user.githubUsername,
    githubProfile: user.githubProfile as GithubUser | null,
    githubInstallations: installationResponses,
    ownedProjectCount,
    createdStampSec: toSeconds(user.createdAt),
    updatedStampSec: toSeconds(user.updatedAt),
  }
  res.json(response)
}

export const deleteAccount: RequestHandler = async (_req, res) => {
  const { user } = res.locals

  log.warn({ user }, `Deleting account for user ${user.id} (${user.email})`)

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

  res.status(200).json({ success: true, message: "Account deleted successfully" })
}
