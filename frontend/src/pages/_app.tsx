import "@/styles/globals.css"
import type { AppProps } from "next/app"

if (!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID) {
  throw new Error("NEXT_PUBLIC_GITHUB_CLIENT_ID is not defined. Please set it in .env.local")
}

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
