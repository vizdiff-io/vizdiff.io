import "@/styles/globals.css"
import "@/styles/theme.css"
import { CssBaseline, ThemeProvider } from "@mui/material"
import type { AppProps } from "next/app"
import { Inter } from "next/font/google"

import DarkMode from "@/components/DarkMode"
import useAppTheme from "@/hooks/useAppTheme"

const inter = Inter({ subsets: ["latin"] })

if (!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID) {
  throw new Error("NEXT_PUBLIC_GITHUB_CLIENT_ID is not defined. Please set it in .env.local")
}

export default function App({ Component, pageProps }: AppProps): JSX.Element {
  const theme = useAppTheme()

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
