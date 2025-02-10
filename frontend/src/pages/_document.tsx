import { Html, Head, Main, NextScript } from "next/document"

import { FallbackStyles, MagicScriptTag } from "@/components/InlineCssVariables"

export default function Document(): JSX.Element {
  return (
    <Html lang="en">
      <Head>
        <FallbackStyles />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body>
        <MagicScriptTag />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
