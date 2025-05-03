import "@/styles/globals.css"
import "@/styles/theme.css"
import { TrackingConsent } from "@datadog/browser-core"
import { datadogRum } from "@datadog/browser-rum"
import { CssBaseline, ThemeProvider } from "@mui/material"
import { GoogleAnalytics } from "@next/third-parties/google"
import type { AppProps } from "next/app"
import { Inter } from "next/font/google"
import Head from "next/head"
import type { JSX } from "react"

import DarkMode from "@/components/DarkMode"
import useAppTheme from "@/hooks/useAppTheme"
import { AuthProvider } from "@/hooks/useAuth"
import { BreadcrumbProvider } from "@/hooks/useBreadcrumbs"
import { DD_APPLICATION_ID, DD_CLIENT_TOKEN, GA_ID, IS_PRODUCTION } from "@/lib/environment"
import { PRIMARY_COLOR, PRIMARY_COLOR_DARK } from "@/lib/theme"

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

const TITLE = "VizDiff: Visual Screenshot Testing for Storybook + GitHub"
const DESCRIPTION =
  "VizDiff automates visual regression by capturing Storybook screenshots in CI, highlighting pixel diffs, and adding GitHub checks before you merge."

export default function App({ Component, pageProps }: AppProps): JSX.Element {
  const theme = useAppTheme()

  return (
    <>
      <Head>
        <title key="title">{TITLE}</title>
        <meta key="og:title" property="og:title" content={TITLE} />
        <meta key="description" name="description" content={DESCRIPTION} />
        <meta key="og:description" property="og:description" content={DESCRIPTION} />

        <meta key="viewport" name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          key="theme-color-light"
          name="theme-color"
          content={PRIMARY_COLOR}
          media="(prefers-color-scheme: light)"
        />
        <meta
          key="theme-color-dark"
          name="theme-color"
          content={PRIMARY_COLOR_DARK}
          media="(prefers-color-scheme: dark)"
        />

        {/* Open Graph */}
        <meta key="og:site_name" property="og:site_name" content="VizDiff" />
        <meta key="og:type" property="og:type" content="website" />
        <meta key="og:image" property="og:image" content="https://vizdiff.io/opengraph-image.png" />
        <meta
          key="og:image:alt"
          property="og:image:alt"
          content="VizDiff: Screenshot testing made easy."
        />
        <meta key="og:image:type" property="og:image:type" content="image/png" />
        <meta key="og:image:width" property="og:image:width" content="1200" />
        <meta key="og:image:height" property="og:image:height" content="630" />

        {/* Twitter Card */}
        <meta key="twitter:card" name="twitter:card" content="summary_large_image" />
        <meta key="twitter:site" name="twitter:site" content="@viz_diff" />
        <meta key="twitter:creator" name="twitter:creator" content="@ada__pixel" />
        <meta
          key="twitter:image"
          name="twitter:image"
          content="https://vizdiff.io/twitter-image.png"
        />
        <meta
          key="twitter:image:alt"
          name="twitter:image:alt"
          content="VizDiff: Screenshot testing made easy."
        />
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
