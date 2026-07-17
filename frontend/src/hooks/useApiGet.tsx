import { AxiosError } from "axios"
import { useState, useEffect, type DependencyList } from "react"

import { apiGet } from "@/lib/apiMethods"

export default function useApiGet<T>(
  endpoint: string | undefined,
  deps?: DependencyList,
): [T | null, boolean, AxiosError | null] {
  const [data, setData] = useState<T | null>(null)
  // Start in the loading state whenever a fetch will run, so consumers don't flash their
  // empty states ("no data yet") on first paint before the effect below kicks off.
  const [isLoading, setIsLoading] = useState<boolean>(endpoint != undefined)
  const [error, setError] = useState<AxiosError | null>(null)

  useEffect(() => {
    if (endpoint == undefined) {
      setIsLoading(false)
      setData(null)
      setError(null)
      return
    }

    // Guard against out-of-order responses: if the endpoint (or deps) change while a
    // request is in flight, a slow earlier response must not overwrite the newer one
    let cancelled = false
    setIsLoading(true)
    apiGet<T>(endpoint)
      .then(([fetchedData, err]) => {
        if (cancelled) {
          return
        }
        setData(fetchedData)
        setError(err)
        setIsLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return
        }
        setError(err instanceof AxiosError ? err : new AxiosError(String(err)))
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [endpoint, ...(deps ?? [])]) // eslint-disable-line react-hooks/exhaustive-deps

  return [data, isLoading, error]
}
