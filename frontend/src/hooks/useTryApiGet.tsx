import { AxiosError } from "axios"
import { useState, useEffect, type DependencyList } from "react"

import { tryApiGet } from "@/lib/apiMethods"

export default function useTryApiGet<T>(
  endpoint: string,
  deps?: DependencyList,
): [T | null, boolean, AxiosError | null] {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<AxiosError | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const [fetchedData, err] = await tryApiGet<T>(endpoint)
      setData(fetchedData)
      setError(err)
      setIsLoading(false)
    }
    fetchData().catch(setError)
  }, [endpoint, ...(deps ?? [])]) // eslint-disable-line react-hooks/exhaustive-deps

  return [data, isLoading, error]
}
