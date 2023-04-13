import { Request, Response, NextFunction } from "express"
import jwt, { JwtPayload, VerifyErrors } from "jsonwebtoken"
import { AuthenticatedRequest } from "./types"
import { log } from "./log"
import { JWT_SECRET } from "./environment"

export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1]

  if (!token) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  jwt.verify(
    token,
    JWT_SECRET,
    { complete: false },
    (err: VerifyErrors | null, decoded: JwtPayload | string | undefined) => {
      if (err) {
        log.warn(`JWT verification failed: ${err.message}`)
        res.status(403).json({ error: "Forbidden" })
        return
      }

      if (typeof decoded !== "object" || !decoded.sub) {
        log.warn(
          `JWT verification failed: decoded payload is not an object or does not contain a "sub" field`,
        )
        res.status(403).json({ error: "Forbidden" })
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
