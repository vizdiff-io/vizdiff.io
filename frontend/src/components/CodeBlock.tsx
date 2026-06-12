import React from "react"
import { Prism, type SyntaxHighlighterProps } from "react-syntax-highlighter"

// `react-syntax-highlighter` is not typed for React 18
const SyntaxHighlighter = Prism as unknown as typeof React.Component<SyntaxHighlighterProps>

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
    <SyntaxHighlighter language={language} PreTag="pre">
      {codeString}
    </SyntaxHighlighter>
  )
}

export default CodeBlock
