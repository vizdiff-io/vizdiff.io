import "@/styles/globals.css"
import type { AppProps } from "next/app"
import theme from "@/components/Theme"
import { ThemeProvider } from "@mui/material/styles"

if (!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID) {
  throw new Error("NEXT_PUBLIC_GITHUB_CLIENT_ID is not defined. Please set it in .env.local")
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider theme={theme}>
      <Component {...pageProps} />
    </ThemeProvider>
  )
}
