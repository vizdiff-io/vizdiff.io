import { Request, Response } from "express"
import { ParsedQs } from "qs"

export type DefaultRequest = Request<unknown, unknown, unknown, ParsedQs, Record<string, unknown>>
export type DefaultResponse = Response<unknown, Record<string, unknown>>
export type AuthenticatedRequest = DefaultRequest & { userId: number }
export type MaybeAuthenticatedRequest = DefaultRequest & { userId?: number }
