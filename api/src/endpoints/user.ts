import { getUser } from "../authenticate"
import type { GithubUser } from "../schemas/GithubUser"
import type { DefaultRequest, DefaultResponse } from "../types"

export async function me(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  res.json({
    ...user, // eslint-disable-line @typescript-eslint/no-misused-spread
    githubProfile: JSON.parse(user.githubProfile) as GithubUser,
    githubAccessToken: undefined,
  })
}
