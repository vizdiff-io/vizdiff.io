import { useState, useEffect, DependencyList } from "react"
import { AxiosError } from "axios"
import { apiGet } from "../lib/apiMethods"

export default function useApiGet<T>(
  endpoint: string,
  deps?: DependencyList | undefined,
): [T | null, boolean, AxiosError | null] {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<AxiosError | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const [data, err] = await apiGet<T>(endpoint)
      setData(data)
      setError(err)
      setIsLoading(false)
    }
    fetchData()
  }, [endpoint, ...(deps ?? [])]) // eslint-disable-line react-hooks/exhaustive-deps

  return [data, isLoading, error]
}
