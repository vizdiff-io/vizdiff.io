import React from "react"
import { Prism, type SyntaxHighlighterProps } from "react-syntax-highlighter"

const SyntaxHighlighter = Prism as unknown as typeof React.Component<SyntaxHighlighterProps>

const CodeBlock = ({
  language,
  value,
}: {
  language: string
  value: React.ReactNode
}): React.JSX.Element => {
  const codeString = String(value as string).replace(/\n$/, "")
  return (
    <SyntaxHighlighter language={language} PreTag="pre">
      {codeString}
    </SyntaxHighlighter>
  )
}

export default CodeBlock
