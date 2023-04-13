import { User } from "../entity/User"
import { Database } from "../database"
import { DataSource } from "typeorm"
import { DefaultRequest, DefaultResponse, MaybeAuthenticatedRequest } from "../types"
import { log } from "../log"

export async function user(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  if (!user) {
    log.error(`getUser() failed to retrieve a user`)
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  res.json({ ...user, githubProfile: JSON.parse(user.githubProfile), githubAccessToken: undefined })
}

async function getUser(req: DefaultRequest): Promise<User> {
  const maybeAuthedReq = req as MaybeAuthenticatedRequest
  if (maybeAuthedReq.userId == undefined) {
    throw new Error(`Request is not authenticated`)
  }

  const userId = maybeAuthedReq.userId
  const db: DataSource = await Database()
  const user = await db.manager.findOneBy(User, { id: userId })
  if (!user) {
    throw new Error(`User id "${userId}" not found`)
  }

  log.debug(`User ${user.id} (${user.githubUsername}) retrieved from the database`)
  return user
}
