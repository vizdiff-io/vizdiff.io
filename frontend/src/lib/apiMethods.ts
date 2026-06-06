import axios, { AxiosError } from "axios"

import { APP_URL } from "./environment"

const TIMEOUT_MS = 1000 * 30

export function isAuthenticated(): boolean {
  return document.cookie.split("; ").find((row) => row === "authenticated=true") != undefined
}

/**
 * Redirects to the login page with a redirect param so the user returns after signing in. Login is
 * handled by the configured AuthProvider (OIDC/MSAL or dev) via the API's /api/auth/login endpoint.
 */
export function redirectToLogin(redirectUri?: string): void {
  const target =
    redirectUri ?? (typeof window !== "undefined" ? window.location.href : `${APP_URL}/projects`)
  const origin = typeof window !== "undefined" ? window.location.origin : APP_URL
  window.location.href = `${origin}/login?redirect=${encodeURIComponent(target)}`
}

export async function apiGet<T>(endpoint: string): Promise<[T | null, AxiosError | null]> {
  if (!isAuthenticated()) {
    const error = new AxiosError()
    error.response = { status: 401 } as AxiosError["response"]
    redirectIfUnauthorized(error)
    return [null, error]
  }

  try {
    const response = await axios.get<T>(endpoint, { withCredentials: true, timeout: TIMEOUT_MS })
    return [response.data, null]
  } catch (err) {
    const axErr = err as AxiosError
    console.warn(`Failed to GET ${endpoint}`, axErr)
    redirectIfUnauthorized(axErr)
    extractServerErrorMessage(axErr)
    return [null, axErr]
  }
}

export async function publicApiGet<T>(
  endpoint: string,
  headers?: Record<string, string>,
): Promise<[T | null, AxiosError | null]> {
  try {
    const response = await axios.get<T>(endpoint, {
      withCredentials: true,
      timeout: TIMEOUT_MS,
      headers,
    })
    return [response.data, null]
  } catch (err) {
    const axErr = err as AxiosError
    extractServerErrorMessage(axErr)
    return [null, axErr]
  }
}

export async function tryApiGet<T>(endpoint: string): Promise<[T | null, AxiosError | null]> {
  if (!isAuthenticated()) {
    const error = new AxiosError()
    error.response = { status: 401 } as AxiosError["response"]
    return [null, error]
  }

  try {
    const response = await axios.get<T>(endpoint, { withCredentials: true, timeout: TIMEOUT_MS })
    return [response.data, null]
  } catch (err) {
    const axErr = err as AxiosError
    extractServerErrorMessage(axErr)
    console.info(`[!] GET ${endpoint}`, axErr)
    return [null, axErr]
  }
}

export async function apiPost<T>(
  endpoint: string,
  body: unknown,
  timeoutMs: number = TIMEOUT_MS,
): Promise<[T | undefined, AxiosError | undefined]> {
  if (!isAuthenticated()) {
    const error = new AxiosError()
    error.response = { status: 401 } as AxiosError["response"]
    return [undefined, error]
  }

  try {
    const response = await axios.post<T>(endpoint, body, {
      headers: { "Content-Type": "application/json" },
      withCredentials: true,
      timeout: timeoutMs,
    })
    return [response.data, undefined]
  } catch (err) {
    const axErr = err as AxiosError
    console.error(`Failed to POST ${endpoint}`, axErr)
    redirectIfUnauthorized(axErr)
    extractServerErrorMessage(axErr)
    return [undefined, axErr]
  }
}

export async function publicApiPost<T>(
  endpoint: string,
  body: unknown,
  timeoutMs: number = TIMEOUT_MS,
  headers?: Record<string, string>,
): Promise<[T | undefined, AxiosError | undefined]> {
  try {
    const response = await axios.post<T>(endpoint, body, {
      headers: { "Content-Type": "application/json", ...headers },
      withCredentials: true,
      timeout: timeoutMs,
    })
    return [response.data, undefined]
  } catch (err) {
    const axErr = err as AxiosError
    extractServerErrorMessage(axErr)
    return [undefined, axErr]
  }
}

export async function apiDelete<T>(
  endpoint: string,
): Promise<[T | undefined, AxiosError | undefined]> {
  if (!isAuthenticated()) {
    const error = new AxiosError()
    error.response = { status: 401 } as AxiosError["response"]
    return [undefined, error]
  }

  try {
    const response = await axios.delete<T>(endpoint, { withCredentials: true, timeout: TIMEOUT_MS })
    return [response.data, undefined]
  } catch (err) {
    const axErr = err as AxiosError
    console.error(`Failed to DELETE ${endpoint}`, axErr)
    redirectIfUnauthorized(axErr)
    extractServerErrorMessage(axErr)
    return [undefined, axErr]
  }
}

function redirectIfUnauthorized(err: AxiosError): void {
  if (err.response?.status === 401) {
    redirectToLogin(window.location.href)
  }
}

function extractServerErrorMessage(axErr: AxiosError): void {
  // Extract error message from response if available
  if (axErr.response?.data && typeof axErr.response.data === "object") {
    const apiErrorMsg = (axErr.response.data as { error?: string }).error
    if (apiErrorMsg) {
      axErr.message = apiErrorMsg
    }
  }
}
