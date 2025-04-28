import React from "react"

import CodeBlock from "./CodeBlock"

// Helper component to render code blocks in <ReactMarkdown> components
export default function MarkdownCode({
  ...props
}: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>): React.JSX.Element {
  const match = /language-(\w+)/.exec(props.className ?? "")
  const language = match?.[1]
  return language ? <CodeBlock language={language} value={props.children} /> : <code {...props} />
}
