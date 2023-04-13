import { Request, Response, NextFunction } from "express"
import jwt, { JwtPayload, VerifyErrors } from "jsonwebtoken"
import { AuthenticatedRequest } from "./types"
import { log } from "./log"

export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1]

  if (!token) {
    res.status(401).send("Unauthorized")
    return
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET as string,
    { complete: false },
    (err: VerifyErrors | null, decoded: JwtPayload | string | undefined) => {
      if (err) {
        res.status(403).send("Forbidden")
        return
      }

      if (typeof decoded !== "object" || !decoded.sub) {
        res.status(403).send("Forbidden")
        return
      }

      // Set req.userId from the verified JWT payload
      const reqWithUserId = req as AuthenticatedRequest
      reqWithUserId.userId = parseInt(decoded.sub, 10)
      log.debug(`Request authenticated as user ${reqWithUserId.userId} via JWT`)
      next()
    },
  )
}
