import { Request, Response } from "express"
import { ParsedQs } from "qs"

export type DefaultRequest = Request<{}, any, any, ParsedQs, Record<string, any>>
export type DefaultResponse = Response<any, Record<string, any>>
export type AuthenticatedRequest = DefaultRequest & { userId: number }
export type MaybeAuthenticatedRequest = DefaultRequest & { userId?: number }
