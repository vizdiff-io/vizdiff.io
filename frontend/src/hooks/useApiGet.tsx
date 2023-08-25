import { useState, useEffect } from "react"
import axios, { AxiosError } from "axios"
import { apiGet } from "../lib/apiMethods"

export default function useApiGet<T>(endpoint: string): [T | null, boolean, AxiosError | null] {
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
  }, [endpoint])

  return [data, isLoading, error]
}
