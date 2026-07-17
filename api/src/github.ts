import { createAppAuth } from "@octokit/auth-app"
import type { RestEndpointMethodTypes } from "@octokit/rest"
import { Octokit } from "@octokit/rest"
import { GitHubInstallation, User } from "shared"

import { Database } from "./database"
import {
  GITHUB_APP_ID,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_PRIVATE_KEY,
} from "./environment"
import { log } from "./log"

type Installation =
  RestEndpointMethodTypes["apps"]["listInstallationsForAuthenticatedUser"]["response"]["data"]["installations"][number]

interface GitHubAccount {
  id: number
  login: string
  type: "User" | "Organization"
}

export interface GitHubCheckData {
  owner: string
  repo: string
  checkRunId: number
  installationId: number
}

/**
 * Get an authenticated Octokit instance for a specific installation
 */
export async function getOctokitForInstallation(installationId: number): Promise<Octokit> {
  const auth = createAppAuth({
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_PRIVATE_KEY,
    clientId: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
  })

  const installationAuth = await auth({ type: "installation", installationId })
  return new Octokit({ auth: installationAuth.token })
}

export async function syncUserInstallations(
  user: User,
  specificInstallationId?: number,
): Promise<GitHubInstallation[]> {
  const db = await Database()

  // The access token column is `select: false`, so a user loaded through the default selection
  // (e.g. `requireUser`) does not carry it. Fetch it explicitly when absent.
  let accessToken: string | null = user.githubAccessToken ?? null
  if (accessToken == null) {
    const userWithToken = await db
      .createQueryBuilder(User, "user")
      .addSelect("user.githubAccessToken")
      .where("user.id = :id", { id: user.id })
      .getOne()
    accessToken = userWithToken?.githubAccessToken ?? null
  }

  const octokit = new Octokit({ auth: accessToken })
  const installations = await octokit.apps.listInstallationsForAuthenticatedUser()

  // Filter to just our app's installations
  const ourInstallations = installations.data.installations.filter(
    (inst): inst is Installation =>
      inst.app_id === parseInt(GITHUB_APP_ID, 10) && inst.account != null,
  )

  // If a specific installation ID was provided but not found in the list, log a warning
  if (
    specificInstallationId &&
    !ourInstallations.some((inst) => inst.id === specificInstallationId)
  ) {
    log.warn(`Could not find GitHub installation ${specificInstallationId} for user ${user.id}`)
  }

  const results: GitHubInstallation[] = []
  for (const inst of ourInstallations) {
    // Create/update installation record
    let installation = await db.manager.findOneBy(GitHubInstallation, {
      installationId: inst.id,
    })

    const account = inst.account as GitHubAccount
    const accountId = String(account.id)
    const accountName = account.login
    const accountType = account.type

    if (!installation) {
      // Create new installation
      log.debug(`Creating new GitHub installation for ${accountName} with creator ${user.id}`)

      try {
        // Create the installation with all required fields
        await db.manager
          .createQueryBuilder()
          .insert()
          .into(GitHubInstallation)
          .values([
            {
              installationId: inst.id,
              accountId,
              accountName,
              accountType,
              creatorId: user.id,
            },
          ])
          .execute()

        // Get the newly created installation
        installation = await db.manager.findOneBy(GitHubInstallation, {
          installationId: inst.id,
        })

        if (!installation) {
          throw new Error("Failed to find newly created installation")
        }

        log.debug(
          `Created GitHub installation ${installation.id} with creator ${installation.creatorId}`,
        )
      } catch (error) {
        log.error(error, "Failed to save installation")
        throw error
      }
    } else if (
      installation.accountId !== accountId ||
      installation.accountName !== accountName ||
      installation.accountType !== accountType
    ) {
      // Only update if data has changed
      const oldCreatorId = installation.creatorId
      installation.accountId = accountId
      installation.accountName = accountName
      installation.accountType = accountType
      log.debug(
        `Updating GitHub installation ${installation.id} for ${accountName}, creator was ${oldCreatorId} and user is ${user.id}`,
      )
      installation = await db.manager.save(GitHubInstallation, installation)
      log.debug(
        `Updated GitHub installation ${installation.id}, creator is ${installation.creatorId}`,
      )
    }

    // Link to user if not already linked
    const userInstallation = await db.manager
      .createQueryBuilder()
      .select("ui.user_id", "userId")
      .from("user_github_installations", "ui")
      .where("ui.user_id = :userId AND ui.installation_id = :installationId", {
        userId: user.id,
        installationId: installation.id,
      })
      .getRawOne<{ userId: number }>()

    if (!userInstallation) {
      await db.manager
        .createQueryBuilder()
        .insert()
        .into("user_github_installations")
        .values({
          user_id: user.id,
          installation_id: installation.id,
        })
        .execute()
    }

    results.push(installation)
  }

  log.info(
    `GitHub installation sync for user ${user.githubUsername} (${user.id}) ` +
      `found ${results.length} installations`,
  )

  return results
}

export async function getInstallationsForUserId(userId: number): Promise<GitHubInstallation[]> {
  const db = await Database()
  return await db.manager
    .createQueryBuilder(GitHubInstallation, "inst")
    .innerJoin("user_github_installations", "ui", "ui.installation_id = inst.id")
    .where("ui.user_id = :userId", { userId })
    .orWhere("inst.creator_id = :userId", { userId })
    .getMany()
}

export async function getInstallationForOrg(
  userId: number,
  orgName: string,
): Promise<GitHubInstallation | null> {
  const db = await Database()
  return await db.manager
    .createQueryBuilder(GitHubInstallation, "inst")
    .innerJoin("user_github_installations", "ui", "ui.installation_id = inst.id")
    .where("(ui.user_id = :userId OR inst.creator_id = :userId) AND inst.accountName = :orgName", {
      userId,
      orgName,
    })
    .getOne()
}

export async function getGithubProject(
  repoUrl: string,
  githubAccessToken: string,
): Promise<RestEndpointMethodTypes["repos"]["get"]["response"]["data"]> {
  const [owner, repo] = repoUrl.split("/").slice(-2)
  if (!owner || !repo) {
    throw new Error(`Invalid GitHub repository URL: ${repoUrl}`)
  }

  const octokit = new Octokit({ auth: githubAccessToken })
  const repoInfo = await octokit.rest.repos.get({ owner, repo })
  return repoInfo.data
}
