// useDarkMode.tsx

import { useEffect, useState, useContext, createContext } from "react"

export interface DarkModeContextType {
  isDarkMode: boolean
}

export const DarkModeContext = createContext<DarkModeContextType | null>(null)

// Default to light mode during SSR to avoid hydration mismatch
const initialDarkMode = false

export const useDarkMode = (): boolean => {
  const context = useContext(DarkModeContext)
  const [systemDarkMode, setSystemDarkMode] = useState(initialDarkMode)
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
    if (context != null) {
      return
    }

    // Only check system preferences after mount
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    setSystemDarkMode(mediaQuery.matches)
    const listener = () => setSystemDarkMode(mediaQuery.matches)
    mediaQuery.addEventListener("change", listener)
    return () => mediaQuery.removeEventListener("change", listener)
  }, [context])

  // During SSR and initial mount, always return false (light mode)
  if (!hasMounted) {
    return false
  }

  return context != null ? context.isDarkMode : systemDarkMode
}
