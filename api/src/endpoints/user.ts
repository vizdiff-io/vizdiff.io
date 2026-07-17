import { Project, projectKeyPrefix } from "shared"

import type { GitHubInstallationResponse, UserResponse } from "../apiTypes"
import { toSeconds } from "../conversions"
import { Database } from "../database"
import { GITHUB_ENABLED } from "../environment"
import { getInstallationsForUserId } from "../github"
import { log } from "../log"
import { deleteObjectsByPrefixes } from "../s3"
import type { GithubUser } from "../schemas/GithubUser"
import type { RequestHandler } from "../types"

export const me: RequestHandler = async (_req, res) => {
  const { user } = res.locals

  // Count the number of projects owned by this user (only surfaced by this endpoint)
  const db = await Database()
  const ownedProjectCount = await db.manager.count(Project, { where: { user: { id: user.id } } })

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

  log.warn({ userId: user.id }, `Deleting account for user ${user.id} (${user.email})`)

  let projectIds: number[] = []
  try {
    const db = await Database()

    // Capture the owned project IDs *before* the delete: the DB cascade removes the project rows,
    // so we must enumerate the per-project S3 prefixes to reap while they still exist (#132).
    const projects = await db
      .getRepository(Project)
      .find({ select: { id: true }, where: { user: { id: user.id } } })
    projectIds = projects.map((p) => p.id)

    await db.transaction(async (manager) => {
      await manager.remove(user)
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    log.error(error, `Failed to delete account for user ${user.id} (${user.email})`)
    res.status(500).json({ error: "Failed to delete account", message })
    return
  }

  // Best-effort S3 cleanup of the owned screenshots (#132). The DB rows are already gone, so an S3
  // failure here must NOT fail the request; it is logged and left for the retention reaper (#79) to
  // sweep later. Deletion is idempotent, so a retry is always safe.
  if (projectIds.length > 0) {
    const prefixes = projectIds.map((id) => projectKeyPrefix(id))
    deleteObjectsByPrefixes(prefixes)
      .then(({ deleted, errors }) => {
        log.info(
          `Deleted screenshots for ${projectIds.length} project(s) of user ${user.id}: ${deleted} objects removed, ${errors} errors`,
        )
      })
      .catch((err: unknown) => {
        log.error(
          err,
          `Failed to delete S3 screenshots for user ${user.id} projects [${projectIds.join(", ")}]`,
        )
      })
  }

  res.clearCookie("token")
  res.clearCookie("authenticated")

  log.info({ userId: user.id }, `Account deleted for user ${user.id} (${user.email})`)

  res.status(200).json({ success: true, message: "Account deleted successfully" })
}
