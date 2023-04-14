import { getUser } from "../authenticate"
import { GithubUser } from "../schemas/GithubUser"
import { DefaultRequest, DefaultResponse } from "../types"

export async function me(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  res.json({
    ...user,
    githubProfile: JSON.parse(user.githubProfile) as GithubUser,
    githubAccessToken: undefined,
  })
}
