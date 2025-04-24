import { Typography, Box, Button, Container } from "@mui/material"
import Head from "next/head"
import type { JSX } from "react"

import { MarketingLayout } from "@/components/NavBody"

export default function Home(): JSX.Element {
  return (
    <>
      <Head>
        <title>vizdiff.io</title>
        <meta name="description" content="Screenshot testing made easy." />
      </Head>
      <MarketingLayout>
        <Container maxWidth="lg">
          <Box
            sx={{
              textAlign: "left",
              pt: { xs: 8, sm: 12, md: 16 },
              pb: { xs: 8, sm: 12 },
              maxWidth: "800px",
            }}
          >
            <Typography
              component="h1"
              variant="h1"
              sx={{
                mb: 2,
                background: "var(--gradient-text)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Check your work before merging with{" "}
              <Box component="span" sx={{ color: "primary.main", WebkitTextFillColor: "#5cc5ff" }}>
                screenshot testing.
              </Box>
            </Typography>
            <Typography
              variant="h6"
              sx={{
                mb: 4,
                fontWeight: "normal",
                lineHeight: 1.6,
              }}
            >
              Catch visual bugs before they ship. Take automated screenshots of your app, compare
              with previous versions, and get notified when they change.
            </Typography>
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button variant="contained" color="primary" size="large">
                Get started
              </Button>
              <Button variant="outlined" size="large">
                Get a demo
              </Button>
            </Box>
          </Box>
        </Container>
      </MarketingLayout>
    </>
  )
}
