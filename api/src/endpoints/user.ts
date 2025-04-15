import { TRIAL_PERIOD_MS } from "src/environment"

import type { GitHubInstallationResponse, UserResponse } from "../apiTypes"
import { getInstallationsForUserId } from "../github"
import type { GithubUser } from "../schemas/GithubUser"
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
