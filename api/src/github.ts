import { createAppAuth } from "@octokit/auth-app"
import type { RestEndpointMethodTypes } from "@octokit/rest"
import { Octokit } from "@octokit/rest"
import { GitHubInstallation, User, UserGithubRepoAccess } from "shared"

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
  const octokit = new Octokit({ auth: user.githubAccessToken })
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

export async function syncUserGithubRepos(user: User): Promise<number> {
  const db = await Database()
  const userId = user.id

  try {
    log.debug({ userId }, "Starting GitHub repo sync")
    const userOctokit = new Octokit({ auth: user.githubAccessToken })

    // 1. List installations accessible by the user for our app
    const installationsResponse = await userOctokit.apps.listInstallationsForAuthenticatedUser()
    const ourInstallations = installationsResponse.data.installations.filter(
      (inst) => inst.app_id === parseInt(GITHUB_APP_ID, 10) && inst.account != null,
    )

    if (ourInstallations.length === 0) {
      log.info(
        { userId, installationsResponse },
        "User has no installations of our GitHub App. Clearing access cache.",
      )
      // Clear existing access if no installations are found
      await db.manager.delete(UserGithubRepoAccess, { userId: user.id })
      return 0
    }

    const installationIds = ourInstallations.map((i) => i.id)
    log.debug(
      { userId, installationsResponse, installationIds },
      `User has access to ${installationIds.length} installation(s)`,
    )

    // 2. Collect all unique repo IDs accessible via these installations
    const accessibleRepoIds = new Set<number>()
    for (const installation of ourInstallations) {
      try {
        log.info({ userId, installation }, `Fetching repos for installation ${installation.id}`)
        const installationOctokit = await getOctokitForInstallation(installation.id)
        // Use iteratePaginate for automatic pagination handling
        const repoIterator = installationOctokit.paginate.iterator(
          installationOctokit.apps.listReposAccessibleToInstallation,
        )

        let countForInstallation = 0
        for await (const { data: repos } of repoIterator) {
          for (const repo of repos) {
            accessibleRepoIds.add(repo.id)
            countForInstallation++
          }
        }
        log.info(
          { userId, installationId: installation.id, countForInstallation },
          `Installation ${installation.id}: Found ${countForInstallation} repos. Total unique repos so far: ${accessibleRepoIds.size}`,
        )
      } catch (err) {
        log.error(
          { user, installation, err },
          `Failed to list repositories for installation ${installation.id} during sync for user ${user.id} (${user.githubUsername})`,
        )
        // Continue with other installations
      }
    }

    log.info(
      { userId, installationIds, accessibleRepoIds },
      `User sync: Found ${accessibleRepoIds.size} total accessible repositories via GitHub App installations.`,
    )

    // 3. Atomically update UserGithubRepoAccess table
    await db.manager.transaction(async (transactionalEntityManager) => {
      // Delete old records
      const deleteResult = await transactionalEntityManager.delete(UserGithubRepoAccess, {
        userId: user.id,
      })
      log.debug(
        { userId, deleteResult },
        `Deleted ${deleteResult.affected ?? 0} existing UserGithubRepoAccess records`,
      )

      // Insert new records if any repos were found
      if (accessibleRepoIds.size > 0) {
        const newAccessRecords = Array.from(accessibleRepoIds).map((repoId) => ({
          userId: user.id,
          githubRepoId: repoId,
        }))

        // Use save which handles bulk inserts efficiently
        const res = await transactionalEntityManager.save(UserGithubRepoAccess, newAccessRecords, {
          chunk: 200, // Process in chunks for large numbers of repos
        })
        log.debug(
          { userId, newAccessRecordCount: res.length },
          `Inserted ${res.length} UserGithubRepoAccess records`,
        )
      }
    })

    log.info({ userId, accessibleRepoIds }, "Successfully completed GitHub repo sync")
    return accessibleRepoIds.size
  } catch (err) {
    log.error({ user, err }, "GitHub repo sync failed")
    throw err
  }
}
