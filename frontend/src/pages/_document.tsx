import { Html, Head, Main, NextScript } from "next/document"
import Script from "next/script"
import type { JSX } from "react"

import { FallbackStyles, MagicScriptTag } from "@/components/InlineCssVariables"

export default function Document(): JSX.Element {
  return (
    <Html lang="en">
      <Head>
        <FallbackStyles />
        {/* Runtime deployment config (see lib/environment.ts). Loaded beforeInteractive so
            window.__VIZDIFF_CONFIG__ is set before the app bundle evaluates environment.ts.
            A default no-op config.js ships in public/; the Helm chart mounts a generated one
            over it to inject per-environment settings. */}
        <Script src="/config.js" strategy="beforeInteractive" />
        <link rel="icon" href="/icon.png" type="image/png" sizes="1024x1024" />
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
      </Head>
      <body>
        <MagicScriptTag />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
