import { type JSX, useEffect } from "react"

import { useDarkMode } from "@/hooks/useDarkMode"
import { COLORS } from "@/lib/theme"

type DarkModeProps = {
  mode?: "light" | "dark"
  children: React.ReactNode
}

export default function DarkMode({ mode, children }: DarkModeProps): JSX.Element {
  const isDarkMode = useDarkMode()

  useEffect(() => {
    const colorMode = mode ?? (isDarkMode ? "dark" : "light")
    const root = document.documentElement

    Object.entries(COLORS).forEach(([name, colorByTheme]) => {
      const cssVarName = `--${name}`
      root.style.setProperty(cssVarName, colorByTheme[colorMode])
    })
  }, [isDarkMode, mode])

  return <>{children}</>
}
