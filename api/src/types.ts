import type { Request, Response } from "express"
import type { ParamsDictionary } from "express-serve-static-core"
import type { ParsedQs } from "qs"
import type { User } from "shared"

export interface DefaultRequest extends Request {
  user?: never
  realIp?: string
}

export interface RequestWithRawBody extends Request {
  rawBody?: Buffer
}

export type DefaultResponse = Response

// Express uses locals for request-scoped data
export interface RequestLocals {
  user: User
  ownedProjectCount: number
}

// This type extends Express's Request while enforcing our user requirement
export type RequestWithUser = Request<ParamsDictionary, unknown, unknown, ParsedQs, RequestLocals>

// This type matches Express's RequestHandler signature while enforcing our user requirement
export type RequestHandler<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
> = (
  req: Request<P, ResBody, ReqBody, ReqQuery, RequestLocals>,
  res: Response<ResBody, RequestLocals>,
) => Promise<void> | void

// Helper type for endpoints that return either data or an error
export type ApiResponse<T> = T | { error: string }
