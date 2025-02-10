import "@/styles/globals.css"
import "@/styles/theme.css"
import { createTheme, CssBaseline, type ThemeOptions } from "@mui/material"
import { ThemeProvider } from "@mui/material"
import type { AppProps } from "next/app"
import { Inter } from "next/font/google"
import { useMemo } from "react"

import DarkMode from "@/components/DarkMode"
import { useDarkMode } from "@/hooks/useDarkMode"
import baseTheme from "@/lib/theme"

const inter = Inter({ subsets: ["latin"] })

if (!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID) {
  throw new Error("NEXT_PUBLIC_GITHUB_CLIENT_ID is not defined. Please set it in .env.local")
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
