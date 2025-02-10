import { createTheme, CssBaseline, type ThemeOptions } from "@mui/material"
import { ThemeProvider } from "@mui/material"
import { Inter } from "next/font/google"
import { useEffect, useState, useMemo } from "react"

import DarkMode from "@/components/DarkMode"
import { DarkModeContext } from "@/hooks/useDarkMode"
import baseTheme, { COLORS } from "@/lib/theme"

const inter = Inter({ subsets: ["latin"] })

export default function ThemeWrapper({
  mode,
  children,
}: {
  mode: "light" | "dark"
  children: React.ReactNode
}): JSX.Element {
  const [isThemeReady, setIsThemeReady] = useState(false)
  const isDarkMode = mode === "dark"

  const theme = useMemo(() => {
    const themeOptions: ThemeOptions = { ...baseTheme, palette: { mode } }
    return createTheme(themeOptions)
  }, [mode])

  useEffect(() => {
    // Set CSS variables in the document root
    const root = document.documentElement
    Object.entries(COLORS).forEach(([name, colorByTheme]) => {
      const cssVarName = `--${name}`
      root.style.setProperty(cssVarName, colorByTheme[mode])
    })
    setIsThemeReady(true)
  }, [mode])

  if (!isThemeReady) {
    return <div style={{ visibility: "hidden" }} />
  }

  return (
    <DarkModeContext.Provider value={{ isDarkMode }}>
      <DarkMode mode={mode}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <div className={inter.className}>{children}</div>
        </ThemeProvider>
      </DarkMode>
    </DarkModeContext.Provider>
  )
}
