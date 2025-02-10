import "@/styles/globals.css"
import "@/styles/theme.css"
import { createTheme, CssBaseline, type ThemeOptions } from "@mui/material"
import { ThemeProvider } from "@mui/material"
import type { AppProps } from "next/app"
import { Inter } from "next/font/google"
import { useEffect, useMemo } from "react"

import { useDarkMode } from "@/hooks/useDarkMode"
import baseTheme, { COLORS } from "@/lib/theme"

const inter = Inter({ subsets: ["latin"] })

if (!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID) {
  throw new Error("NEXT_PUBLIC_GITHUB_CLIENT_ID is not defined. Please set it in .env.local")
}

function DarkMode({ children }: { children: React.ReactNode }): JSX.Element {
  const isDarkMode = useDarkMode()

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    const prefersDarkFromMQ = mql.matches
    const colorMode = prefersDarkFromMQ ? "dark" : "light"
    const root = document.documentElement

    Object.entries(COLORS).forEach(([name, colorByTheme]) => {
      const cssVarName = `--${name}`
      root.style.setProperty(cssVarName, colorByTheme[colorMode])
    })
  }, [isDarkMode])

  return <>{children}</>
}

export default function App({ Component, pageProps }: AppProps): JSX.Element {
  const isDarkMode = useDarkMode()
  const theme = useMemo(() => {
    const themeOptions: ThemeOptions = {
      ...baseTheme,
      palette: { mode: isDarkMode ? "dark" : "light" },
    }
    return createTheme(themeOptions)
  }, [isDarkMode])

  return (
    <DarkMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div className={inter.className}>
          <Component {...pageProps} />
        </div>
      </ThemeProvider>
    </DarkMode>
  )
}
