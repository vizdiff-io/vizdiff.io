import { parse as parseQs, stringify as stringifyQs } from "qs"
import { URL } from "url"

import type { DefaultRequest } from "./types"

const ALLOWED_REDIRECT_DOMAINS = new Set(["localhost", "127.0.0.1", "vizdiff.io"])

export function getParamInt(key: string, req: DefaultRequest): number | undefined {
  const params = req.params as Record<string, string>
  const maybeValue = params[key]
  if (typeof maybeValue === "string") {
    const value = parseInt(maybeValue)
    if (!isNaN(value)) {
      return value
    }
  }
  return undefined
}

export function getQueryString(key: string, req: DefaultRequest): string | undefined {
  const maybeValue = req.query[key]
  return typeof maybeValue === "string" ? maybeValue : undefined
}

export function getParamString(key: string, req: DefaultRequest): string | undefined {
  const maybeValue = (req.params as Record<string, string>)[key]
  return typeof maybeValue === "string" ? maybeValue : undefined
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
export function parseSimpleQueryString(queryString: string): Map<string, string> {
  if (queryString.length > 2048) {
    throw new Error(`Query string too long: ${queryString.length} characters`)
  }
  const parsed = parseQs(queryString, { ignoreQueryPrefix: true })
  const result = new Map<string, string>()
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      result.set(key, value)
    } else if (Array.isArray(value) && value.length > 0) {
      const firstValue = value[0]
      if (typeof firstValue === "string") {
        result.set(key, firstValue)
      }
    }
  }
  if (result.size === 0) {
    throw new Error(`Invalid query string: "${queryString}"`)
  }
  return result
}

export function encodeQueryParams(params: Record<string, string>): string {
  if (Object.entries(params).length === 0) {
    return ""
  }
  return stringifyQs(params, { addQueryPrefix: false })
}
