import "@/styles/globals.css"
import "@/styles/theme.css"
import { TrackingConsent } from "@datadog/browser-core"
import { datadogRum } from "@datadog/browser-rum"
import { CssBaseline, ThemeProvider } from "@mui/material"
import { GoogleAnalytics } from "@next/third-parties/google"
import type { AppProps } from "next/app"
import { Inter } from "next/font/google"
import Head from "next/head"

import DarkMode from "@/components/DarkMode"
import useAppTheme from "@/hooks/useAppTheme"
import { AuthProvider } from "@/hooks/useAuth"
import { BreadcrumbProvider } from "@/hooks/useBreadcrumbs"
import { DD_APPLICATION_ID, DD_CLIENT_TOKEN, GA_ID, IS_PRODUCTION } from "@/lib/environment"

import packageJson from "../../package.json"

if (DD_APPLICATION_ID && DD_CLIENT_TOKEN) {
  datadogRum.init({
    applicationId: DD_APPLICATION_ID,
    clientToken: DD_CLIENT_TOKEN,
    site: "us3.datadoghq.com",
    service: "vizdiff.io",
    env: "production",
    version: packageJson.version,
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    defaultPrivacyLevel: "mask-user-input",
    trackingConsent: TrackingConsent.GRANTED,
  })
}

const inter = Inter({ subsets: ["latin"] })

export default function App({ Component, pageProps }: AppProps): JSX.Element {
  const theme = useAppTheme()

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      {GA_ID && <GoogleAnalytics gaId={GA_ID} debugMode={!IS_PRODUCTION} />}
      <AuthProvider>
        <BreadcrumbProvider>
          <DarkMode>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <div className={inter.className}>
                <Component {...pageProps} />
              </div>
            </ThemeProvider>
          </DarkMode>
        </BreadcrumbProvider>
      </AuthProvider>
    </>
  )
}
