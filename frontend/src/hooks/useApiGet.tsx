import { AxiosError } from "axios"
import { useState, useEffect, type DependencyList } from "react"

import { apiGet } from "@/lib/apiMethods"

interface StorybookPreview {
  renderStoryToElement?: {
    stories?: Record<
      string,
      {
        parameters?: {
          mockData?: unknown
        }
      }
    >
  }
}

declare global {
  interface Window {
    __STORYBOOK_PREVIEW__?: StorybookPreview
  }
}

export default function useApiGet<T>(
  endpoint: string,
  deps?: DependencyList,
): [T | null, boolean, AxiosError | null] {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<AxiosError | null>(null)

  useEffect(() => {
    // Check if we're in Storybook and have mock data
    if (typeof window !== "undefined" && window.location.href.includes("?path=/story/")) {
      const params = new URLSearchParams(window.location.search)
      const storyId = params.get("id")
      if (storyId) {
        const storyData =
          // eslint-disable-next-line no-underscore-dangle
          window.__STORYBOOK_PREVIEW__?.renderStoryToElement?.stories?.[storyId]?.parameters
            ?.mockData
        if (storyData) {
          setData(storyData as T)
          setIsLoading(false)
          setError(null)
          return
        }
      }
    }

    const fetchData = async () => {
      setIsLoading(true)
      const [fetchedData, err] = await apiGet<T>(endpoint)
      setData(fetchedData)
      setError(err)
      setIsLoading(false)
    }
    fetchData().catch(setError)
  }, [endpoint, ...(deps ?? [])]) // eslint-disable-line react-hooks/exhaustive-deps

  return [data, isLoading, error]
}
