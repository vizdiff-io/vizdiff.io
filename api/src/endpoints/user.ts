import { Express } from "express"
import { User } from "../entity/User"
import { AuthenticatedRequest } from "../authenticate"
import { Database } from "../database"
import { DataSource } from "typeorm"
import { authenticateJWT } from "../authenticate"

export const user = (app: Express) => {
  // Return the current user
  app.get("/users/me", async (req, res, next) => {
    const user = await getUser(req)
    if (!user) {
      res.status(401).send("Unauthorized")
      return
    }
    res.send(user)
  })
}

async function getUser(req: AuthenticatedRequest): Promise<User> {
  const db: DataSource = await Database()
  const user = await db.manager.findOneBy(User, { id: req.userId })
  if (!user) {
    throw new Error(`User id "${req.userId}" not found`)
  }
  return user
}
