import { createAppAuth } from "@octokit/auth-app"
import { Octokit } from "@octokit/rest"
import type { RestEndpointMethodTypes } from "@octokit/rest"

import {
  GITHUB_APP_ID,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_PRIVATE_KEY,
} from "../environment"
import { getInstallationForOrg, getInstallationsForUserId, syncUserInstallations } from "../github"
import { log } from "../log"
import type { RequestHandler } from "../types"

const GITHUB_HEADERS = { "X-GitHub-Api-Version": "2022-11-28" }

async function getOctokitForUser(installationId: number): Promise<Octokit> {
  const auth = createAppAuth({
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_PRIVATE_KEY,
    clientId: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
  })
  const installationAuth = await auth({ type: "installation", installationId })
  return new Octokit({ auth: installationAuth.token })
}

type OrgResponse = RestEndpointMethodTypes["orgs"]["list"]["response"]["data"][number]

export const orgs: RequestHandler = async (_req, res) => {
  const { user } = res.locals

  // Ensure installations are up to date
  const installations = await syncUserInstallations(user)
  if (installations.length === 0) {
    res.status(403).json({ error: "GitHub App installation required for this endpoint" })
    return
  }

  // Get orgs for all installations
  const allOrgs: OrgResponse[] = []
  for (const installation of installations) {
    const octokit = await getOctokitForUser(installation.installationId)
    const ghRes = await octokit.request("GET /user/orgs", {
      headers: GITHUB_HEADERS,
      per_page: 100,
    })

    // Only include orgs where we have an installation
    const installedOrgs = ghRes.data.filter((org) =>
      installations.some(
        (inst) => inst.accountType === "Organization" && inst.accountId === String(org.id),
      ),
    )
    allOrgs.push(...installedOrgs)
  }

  log.debug(`Found ${allOrgs.length} GitHub orgs for ${user.githubUsername}`)
  res.json(allOrgs)
}

type OrgRepoResponse = RestEndpointMethodTypes["repos"]["listForOrg"]["response"]["data"][number]
type UserRepoResponse =
  RestEndpointMethodTypes["repos"]["listForAuthenticatedUser"]["response"]["data"][number]
type RepoResponse = OrgRepoResponse | UserRepoResponse

export const repos: RequestHandler = async (req, res) => {
  const { user } = res.locals
  const org = req.query.org as string | undefined

  // Ensure installations are up to date
  await syncUserInstallations(user)

  const installation = org
    ? await getInstallationForOrg(user, org)
    : (await getInstallationsForUserId(user.id)).find((i) => i.accountType === "User")

  if (!installation) {
    res.status(403).json({ error: "GitHub App installation required for this endpoint" })
    return
  }

  const octokit = await getOctokitForUser(installation.installationId)
  const ghRes = org
    ? await octokit.request("GET /orgs/{org}/repos", {
        headers: GITHUB_HEADERS,
        sort: "pushed",
        type: "all",
        org,
        per_page: 100,
      })
    : await octokit.request("GET /user/repos", {
        headers: GITHUB_HEADERS,
        sort: "pushed",
        affiliation: "owner,collaborator",
        per_page: 100,
      })

  log.debug(`Found ${ghRes.data.length} GitHub projects (user=${user.githubUsername}, org=${org})`)
  res.json(ghRes.data as RepoResponse[])
}
