import { Container, Box } from "@mui/material"
import Head from "next/head"
import React from "react"
import ReactMarkdown from "react-markdown"

import { MarketingLayout } from "@/components/NavBody"

const markdown = `
Getting started
===============

...
`

export default function Documentation(): JSX.Element {
  return (
    <>
      <Head>
        <title>Documentation - vizdiff.io</title>
        <meta
          name="description"
          content="Documentation and getting started guide for the vizdiff.io service"
        />
      </Head>
      <MarketingLayout>
        <Container maxWidth="lg">
          <Box
            sx={{
              textAlign: "left",
              maxWidth: "1200px",
            }}
          >
            <Box
              className="privacy-policy"
              sx={{
                "& p": { marginBottom: "1em" },
                "& ul": { marginBottom: "1em" },
                "& h1": { marginBottom: "0.5em" },
                "& h2": { marginBottom: "0.5em" },
                "& h3": { marginBottom: "0.5em" },
                "& h4": { marginBottom: "0.25em" },
              }}
            >
              <ReactMarkdown>{markdown}</ReactMarkdown>
            </Box>
          </Box>
        </Container>
      </MarketingLayout>
    </>
  )
}
