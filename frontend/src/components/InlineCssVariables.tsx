/*
This code comes from https://joshwcomeau.com/gatsby/dark-mode/
It uses the users' prefers-color-scheme media query to inline
CSS variables into the :root of the page before any content is 
rendered.
*/

import * as Terser from "terser"

import { COLORS } from "../lib/theme"

type ColorsMap = Record<string, { dark: string; light: string }>

export function setColorsByTheme(): void {
  // prettier-ignore
  const colors = '🌈' as unknown as ColorsMap

  const mql = window.matchMedia("(prefers-color-scheme: dark)")
  const prefersDarkFromMQ = mql.matches
  const colorMode = prefersDarkFromMQ ? "dark" : "light"

  const root = document.documentElement

  Object.entries(colors).forEach(([name, colorByTheme]) => {
    const cssVarName = `--${name}`
    root.style.setProperty(cssVarName, colorByTheme[colorMode])
  })
}

export function MagicScriptTag(): JSX.Element {
  const boundFn = String(setColorsByTheme).replace("'🌈'", JSON.stringify(COLORS))
  const calledFunction = Terser.minify_sync(`(${boundFn})()`).code ?? ""

  return <script dangerouslySetInnerHTML={{ __html: calledFunction }} />
}

// if user doesn't have JavaScript enabled, set variables properly in a
// head style tag anyways (light mode)
export function FallbackStyles(): JSX.Element {
  const cssVariableString = Object.entries(COLORS).reduce((acc, [name, colorByTheme]) => {
    return `${acc}\n--${name}: ${colorByTheme.light};`
  }, "")

  const wrappedInSelector = `html { ${cssVariableString} }`

  return <style>{wrappedInSelector}</style>
}
