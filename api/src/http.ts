import type { Request } from "express"
import { parse as parseQs, stringify as stringifyQs } from "qs"
import { URL } from "url"

import type { DefaultRequest } from "./types"

const ALLOWED_REDIRECT_DOMAINS = new Set(["localhost", "127.0.0.1", "vizdiff.io"])

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

export function isValidRedirectUrl(redirectUrl: string): boolean {
  try {
    const parsedUrl = new URL(redirectUrl)

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return false
    }

    return ALLOWED_REDIRECT_DOMAINS.has(parsedUrl.hostname)
  } catch (err) {
    // If there's an error parsing the URL, it's not valid.
    void err
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

export function validateRedirectUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    if (ALLOWED_REDIRECT_DOMAINS.has(parsed.hostname)) {
      return url
    }
  } catch {
    // Ignore parse errors
  }
  return undefined
}
