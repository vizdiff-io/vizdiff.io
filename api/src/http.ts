import { DefaultRequest } from "./types"

export function getQueryString(key: string, req: DefaultRequest): string {
  const maybeValue = req.query[key]
  if (!maybeValue || typeof maybeValue !== "string") {
    throw new Error(`Missing query parameter "${key}"`)
  }
  return maybeValue
}

export function getCookieString(key: string, req: DefaultRequest): string {
  const maybeValue = req.cookies[key]
  if (!maybeValue || typeof maybeValue !== "string") {
    throw new Error(`Missing cookie "${key}"`)
  }
  return maybeValue
}
