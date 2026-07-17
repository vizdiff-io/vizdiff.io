import React from "react"
import { PrismLight, type SyntaxHighlighterProps } from "react-syntax-highlighter"
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash"
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml"
import prismStyle from "react-syntax-highlighter/dist/esm/styles/prism/prism"

// Use the light build and register only the languages the docs actually use, instead of the
// full Prism build which bundles every grammar. The `prism` style is the default theme the
// full build applies, so rendering is unchanged.
PrismLight.registerLanguage("bash", bash)
PrismLight.registerLanguage("yaml", yaml)

// `react-syntax-highlighter` is not typed for React 18
const SyntaxHighlighter = PrismLight as unknown as typeof React.Component<SyntaxHighlighterProps>

const CodeBlock = ({
  language,
  value,
}: {
  language: string
  value: React.ReactNode
}): React.JSX.Element => {
  // `value` is typed as ReactNode but, for fenced code blocks rendered by
  // react-markdown, it is always the code text. Narrow to a string before
  // formatting; fall back to an empty string for the (unreachable) non-string case.
  const codeString = (typeof value === "string" ? value : "").replace(/\n$/, "")
  return (
    <SyntaxHighlighter language={language} style={prismStyle} PreTag="pre">
      {codeString}
    </SyntaxHighlighter>
  )
}

export default CodeBlock
