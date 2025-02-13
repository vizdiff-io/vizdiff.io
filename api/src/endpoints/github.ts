import { createAppAuth } from "@octokit/auth-app"
import { Octokit } from "@octokit/rest"

import { getUser } from "../authenticate"
import {
  GITHUB_APP_ID,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_PRIVATE_KEY,
} from "../environment"
import { log } from "../log"
import type { DefaultRequest, DefaultResponse } from "../types"

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

export async function orgs(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)

  if (user.githubInstallationId == null) {
    res.status(403).json({ error: "GitHub App installation required for this endpoint" })
    return
  }

  const octokit = await getOctokitForUser(user.githubInstallationId)
  const ghRes = await octokit.request("GET /user/orgs", { headers: GITHUB_HEADERS, per_page: 100 })
  log.debug(`Found ${ghRes.data.length} GitHub orgs for ${user.githubUsername}`)

  res.json(ghRes.data)
}

export async function repos(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  const org = req.query.org as string | undefined

  if (user.githubInstallationId == null) {
    res.status(403).json({ error: "GitHub App installation required for this endpoint" })
    return
  }

  const octokit = await getOctokitForUser(user.githubInstallationId)
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

  res.json(ghRes.data)
}
