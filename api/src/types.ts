import { Request, Response } from "express"
import { ParsedQs } from "qs"

type StringRecord = Record<string, unknown>

export type DefaultRequest = Request<unknown, unknown, StringRecord, ParsedQs, StringRecord>
export type DefaultResponse = Response<unknown, StringRecord>
export type AuthenticatedRequest = DefaultRequest & { userId: number }
export type MaybeAuthenticatedRequest = DefaultRequest & { userId?: number }

export interface CreateScreenshotTestRequestBody {
  branches_url: string
  html_url: string
  commits_url: string
}
