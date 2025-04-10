import { Html, Head, Main, NextScript } from "next/document"

import { FallbackStyles, MagicScriptTag } from "@/components/InlineCssVariables"

export default function Document(): JSX.Element {
  return (
    <Html lang="en">
      <Head>
        <FallbackStyles />
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
