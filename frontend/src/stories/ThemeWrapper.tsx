import { CssBaseline, ThemeProvider } from "@mui/material"
import { Inter } from "next/font/google"
import { useEffect, useState } from "react"

import DarkMode from "@/components/DarkMode"
import useAppTheme from "@/hooks/useAppTheme"
import { AuthProvider } from "@/hooks/useAuth"
import { DarkModeContext } from "@/hooks/useDarkMode"
import { COLORS } from "@/lib/theme"

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
  const theme = useAppTheme()

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
    <AuthProvider>
      <DarkModeContext.Provider value={{ isDarkMode }}>
        <DarkMode mode={mode}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <div className={inter.className}>{children}</div>
          </ThemeProvider>
        </DarkMode>
      </DarkModeContext.Provider>
    </AuthProvider>
  )
}
