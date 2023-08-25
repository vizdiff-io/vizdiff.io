import { Octokit } from "@octokit/rest"

import { getUser } from "../authenticate"
import { log } from "../log"
import { DefaultRequest, DefaultResponse } from "../types"

const GITHUB_HEADERS = { "X-GitHub-Api-Version": "2022-11-28" }

export async function orgs(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)

  const octokit = new Octokit({ auth: user.githubAccessToken })
  const ghRes = await octokit.request("GET /user/orgs", { headers: GITHUB_HEADERS, per_page: 100 })
  log.debug(`Found ${ghRes.data.length} GitHub orgs for ${user.githubUsername}`)

  res.json(ghRes.data)
}

export async function repos(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  const org = req.query.org as string | undefined

  const octokit = new Octokit({ auth: user.githubAccessToken })
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
