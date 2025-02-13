import "@/styles/globals.css"
import "@/styles/theme.css"
import { CssBaseline, ThemeProvider } from "@mui/material"
import type { AppProps } from "next/app"
import { Inter } from "next/font/google"

import DarkMode from "@/components/DarkMode"
import useAppTheme from "@/hooks/useAppTheme"
import { AuthProvider } from "@/hooks/useAuth"

const inter = Inter({ subsets: ["latin"] })

export default function App({ Component, pageProps }: AppProps): JSX.Element {
  const theme = useAppTheme()

  return (
    <AuthProvider>
      <DarkMode>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <div className={inter.className}>
            <Component {...pageProps} />
          </div>
        </ThemeProvider>
      </DarkMode>
    </AuthProvider>
  )
}
