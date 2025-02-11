import { AxiosError } from "axios"
import { useState, useEffect, type DependencyList } from "react"

import { apiGet } from "@/lib/apiMethods"

export default function useApiGet<T>(
  endpoint: string | undefined,
  deps?: DependencyList,
): [T | null, boolean, AxiosError | null] {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<AxiosError | null>(null)

  useEffect(() => {
    const fetchData = async (url: string) => {
      setIsLoading(true)
      const [fetchedData, err] = await apiGet<T>(url)
      setData(fetchedData)
      setError(err)
      setIsLoading(false)
    }

    if (endpoint) {
      fetchData(endpoint).catch(setError)
    } else {
      setIsLoading(false)
      setData(null)
      setError(null)
    }
  }, [endpoint, ...(deps ?? [])]) // eslint-disable-line react-hooks/exhaustive-deps

  return [data, isLoading, error]
}
