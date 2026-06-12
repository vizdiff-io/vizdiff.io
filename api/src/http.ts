import type { Request } from "express"
import { parse as parseQs, stringify as stringifyQs } from "qs"
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

export function getParamString(name: string, req: Request): string | undefined {
  return req.params[name]
}

export function getCookieString(key: string, req: DefaultRequest): string | undefined {
  const maybeValue = req.cookies[key] as string | undefined
  return typeof maybeValue === "string" ? maybeValue : undefined
}

export function requiredQueryString(key: string, req: DefaultRequest): string {
  const maybeValue = req.query[key] as string | undefined
  if (!maybeValue || typeof maybeValue !== "string") {
    throw new Error(`Missing query parameter "${key}"`)
  }
  return maybeValue
}

export function requiredCookieString(key: string, req: DefaultRequest): string {
  const maybeValue = req.cookies[key] as string | undefined
  if (!maybeValue || typeof maybeValue !== "string") {
    throw new Error(`Missing cookie "${key}"`)
  }
  return maybeValue
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

/** Parses a query string with only unique keys */
export function parseSimpleQueryString(query: string): Map<string, string> {
  const result = new Map<string, string>()
  const parsed = parseQs(query)
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      result.set(key, value)
    }
  }
  return result
}

export function encodeQueryParams(params: Record<string, string>): string {
  if (Object.entries(params).length === 0) {
    return ""
  }
  return stringifyQs(params, { addQueryPrefix: false })
}

export function buildQueryString(params: Record<string, string>): string {
  return stringifyQs(params)
}
