import type { UserResponse } from "../apiTypes"
import { getUser } from "../authenticate"
import type { GithubUser } from "../schemas/GithubUser"
import type { DefaultRequest, DefaultResponse } from "../types"

export async function me(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  const response: UserResponse = {
    id: user.id,
    githubId: user.githubId,
    email: user.email,
    githubUsername: user.githubUsername,
    githubProfile: JSON.parse(user.githubProfile) as GithubUser,
    createdStampSec: user.createdAt.getTime() / 1000,
    updatedStampSec: user.updatedAt.getTime() / 1000,
  }
  res.json(response)
}
