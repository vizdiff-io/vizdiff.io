import type { Request } from "express"
import { URL } from "url"

import type { DefaultRequest } from "./types"

export function getParamInt(name: string, req: Request): number | undefined {
  const value = req.params[name]
  if (!value) {
    return undefined
  }

  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) {
    return undefined
  }

  return parsed
}

export function getQueryString(key: string, req: DefaultRequest): string | undefined {
  const maybeValue = req.query[key]
  return typeof maybeValue === "string" ? maybeValue : undefined
}

export function getQueryInt(key: string, req: DefaultRequest): number | undefined {
  const value = getQueryString(key, req)
  if (value == undefined) {
    return undefined
  }

  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) {
    return undefined
  }

  return parsed
}

export function isValidRedirectUrl(redirectUrl: string, allowedOrigin: string): boolean {
  try {
    const parsedUrl = new URL(redirectUrl)

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return false
    }

    const allowedUrl = new URL(allowedOrigin)
    return parsedUrl.hostname === allowedUrl.hostname && parsedUrl.protocol === allowedUrl.protocol
  } catch {
    // If there's an error parsing either URL, it's not valid.
    return false
  }
}
