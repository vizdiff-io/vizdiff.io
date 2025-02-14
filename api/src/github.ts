import { Octokit } from "@octokit/rest"
import type { RestEndpointMethodTypes } from "@octokit/rest"
import { GitHubInstallation, User } from "shared"

import { Database } from "./database"
import { GITHUB_APP_ID } from "./environment"
import { log } from "./log"

type Installation =
  RestEndpointMethodTypes["apps"]["listInstallationsForAuthenticatedUser"]["response"]["data"]["installations"][number]

interface GitHubAccount {
  id: number
  login: string
  type: "User" | "Organization"
}

export async function syncUserInstallations(user: User): Promise<GitHubInstallation[]> {
  const db = await Database()
  const octokit = new Octokit({ auth: user.githubAccessToken })
  const installations = await octokit.apps.listInstallationsForAuthenticatedUser()

  // Filter to just our app's installations
  const ourInstallations = installations.data.installations.filter(
    (inst): inst is Installation =>
      inst.app_id === parseInt(GITHUB_APP_ID, 10) && inst.account != null,
  )

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
        if (error instanceof Error) {
          log.error(`Failed to save installation: ${error.message}`)
        }
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
  user: User,
  orgName: string,
): Promise<GitHubInstallation | null> {
  const db = await Database()
  return await db.manager
    .createQueryBuilder(GitHubInstallation, "inst")
    .innerJoin("user_github_installations", "ui", "ui.installation_id = inst.id")
    .where("(ui.user_id = :userId OR inst.creator_id = :userId) AND inst.accountName = :orgName", {
      userId: user.id,
      orgName,
    })
    .getOne()
}
