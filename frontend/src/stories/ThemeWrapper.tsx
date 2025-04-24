import { CssBaseline, ThemeProvider } from "@mui/material"
import { Inter } from "next/font/google"
import { type JSX, useEffect, useState } from "react"

import DarkMode from "@/components/DarkMode"
import useAppTheme from "@/hooks/useAppTheme"
import { AuthProvider } from "@/hooks/useAuth"
import { BreadcrumbProvider } from "@/hooks/useBreadcrumbs"
import { DarkModeContext } from "@/hooks/useDarkMode"
import { COLORS } from "@/lib/theme"

const inter = Inter({ subsets: ["latin"] })

export default function ThemeWrapper({
  mode,
  children,
  isAuthenticated = true,
}: {
  mode: "light" | "dark"
  children: React.ReactNode
  isAuthenticated?: boolean
}): JSX.Element {
  const [isThemeReady, setIsThemeReady] = useState(false)
  const isDarkMode = mode === "dark"
  const theme = useAppTheme()

  useEffect(() => {
    // Set CSS variables in the document root
    const root = document.documentElement
    Object.entries(COLORS).forEach(([name, colorByTheme]) => {
      const cssVarName = `--${name}`
      root.style.setProperty(cssVarName, colorByTheme[mode])
    })

    // Set authentication cookie based on prop
    if (isAuthenticated) {
      document.cookie = "authenticated=true; path=/"
    } else {
      document.cookie = "authenticated=false; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
    }

    setIsThemeReady(true)
  }, [mode, isAuthenticated])

  if (!isThemeReady) {
    return <div style={{ visibility: "hidden" }} />
  }

  return (
    <AuthProvider>
      <BreadcrumbProvider>
        <DarkModeContext.Provider value={{ isDarkMode }}>
          <DarkMode mode={mode}>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <div className={inter.className}>{children}</div>
            </ThemeProvider>
          </DarkMode>
        </DarkModeContext.Provider>
      </BreadcrumbProvider>
    </AuthProvider>
  )
}
