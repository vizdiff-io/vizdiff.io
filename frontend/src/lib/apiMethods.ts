import axios, { AxiosError } from "axios"

const TIMEOUT_MS = 1000 * 30

export async function apiGet<T>(endpoint: string): Promise<[T | null, AxiosError | null]> {
  try {
    const response = await axios.get<T>(endpoint, { withCredentials: true, timeout: TIMEOUT_MS })
    return [response.data, null]
  } catch (err) {
    const axErr = err as AxiosError
    console.error(`Failed to GET ${endpoint}`, axErr)
    redirectIfUnauthorized(axErr)
    return [null, axErr]
  }
}

export async function apiPost<T>(
  endpoint: string,
  body: unknown,
  timeoutMs: number = TIMEOUT_MS,
): Promise<[T | undefined, AxiosError | undefined]> {
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
    return [undefined, axErr]
  }
}

export async function apiDelete<T>(
  endpoint: string,
): Promise<[T | undefined, AxiosError | undefined]> {
  try {
    const response = await axios.delete<T>(endpoint, { withCredentials: true, timeout: TIMEOUT_MS })
    return [response.data, undefined]
  } catch (err) {
    const axErr = err as AxiosError
    console.error(`Failed to DELETE ${endpoint}`, axErr)
    redirectIfUnauthorized(axErr)
    return [undefined, axErr]
  }
}

function redirectIfUnauthorized(err: AxiosError): void {
  if (err.response?.status === 401) {
    window.location.href = `/login?redirect=${encodeURIComponent(window.location.href)}`
  }
}
