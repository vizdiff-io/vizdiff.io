// useDarkMode.tsx

import { useEffect, useState, useContext, createContext } from "react"

export interface DarkModeContextType {
  isDarkMode: boolean
}

export const DarkModeContext = createContext<DarkModeContextType | null>(null)

const initialDarkMode =
  typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false

export const useDarkMode = (): boolean => {
  const context = useContext(DarkModeContext)
  const [systemDarkMode, setSystemDarkMode] = useState(initialDarkMode)

  useEffect(() => {
    if (context != null) {
      return
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    setSystemDarkMode(mediaQuery.matches)
    const listener = () => setSystemDarkMode(mediaQuery.matches)
    mediaQuery.addEventListener("change", listener)
    return () => mediaQuery.removeEventListener("change", listener)
  }, [context])

  return context != null ? context.isDarkMode : systemDarkMode
}
