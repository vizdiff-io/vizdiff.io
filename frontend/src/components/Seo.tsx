import Head from "next/head"
import type { JSX } from "react"

import { APP_URL } from "@/lib/environment"

export interface OpenGraphMedia {
  url: string
  width?: number
  height?: number
  alt?: string
  type?: string
}

export interface OpenGraph {
  images?: ReadonlyArray<OpenGraphMedia>
  locale?: string
  siteName?: string
}

export interface SeoProps {
  title?: string
  description?: string
  /** Absolute canonical URL. Prefer `path` so the URL tracks this deployment's APP_URL. */
  canonical?: string
  /** Path (e.g. "/projects") resolved against APP_URL into a deployment-relative canonical URL. */
  path?: string
  openGraph?: OpenGraph
  children?: never
}

export const Seo = (props: SeoProps): JSX.Element => {
  const canonical = props.canonical ?? (props.path != null ? `${APP_URL}${props.path}` : undefined)
  return (
    <Head>
      {props.title && (
        <>
          <title key="title">{props.title}</title>
          <meta key="og:title" property="og:title" content={props.title} />
        </>
      )}
      {props.description && (
        <>
          <meta key="description" name="description" content={props.description} />
          <meta key="og:description" property="og:description" content={props.description} />
        </>
      )}
      {canonical && (
        <>
          <link key="canonical" rel="canonical" href={canonical} />
          <meta key="og:url" property="og:url" content={canonical} />
        </>
      )}
      {props.openGraph && (
        <>
          {(props.openGraph.images ?? []).map((image, index) => (
            <>
              <meta key={`og:image:${index}`} property="og:image" content={image.url} />
              {image.width && (
                <meta
                  key={`og:image:width:${index}`}
                  property="og:image:width"
                  content={image.width.toString()}
                />
              )}
              {image.height && (
                <meta
                  key={`og:image:height:${index}`}
                  property="og:image:height"
                  content={image.height.toString()}
                />
              )}
              {image.alt && (
                <meta key={`og:image:alt:${index}`} property="og:image:alt" content={image.alt} />
              )}
              {image.type && (
                <meta
                  key={`og:image:type:${index}`}
                  property="og:image:type"
                  content={image.type}
                />
              )}
            </>
          ))}
        </>
      )}
    </Head>
  )
}
