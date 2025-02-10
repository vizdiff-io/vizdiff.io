import { Typography, Box, Button, Container } from "@mui/material"
import Head from "next/head"

import { NavBody } from "@/components/NavBody"
import { useDarkMode } from "@/hooks/useDarkMode"

export default function Home(): JSX.Element {
  const isDarkMode = useDarkMode()

  return (
    <>
      <Head>
        <title>vizdiff.io</title>
        <meta name="description" content="Screenshot testing made easy." />
      </Head>
      <NavBody>
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
                background: isDarkMode
                  ? "linear-gradient(to right, #fff 60%, rgba(255,255,255,0.5))"
                  : "linear-gradient(to right, #000 60%, rgba(0,0,0,0.5))",
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
                color: "text.secondary",
                fontWeight: "normal",
                lineHeight: 1.6,
              }}
            >
              Catch visual bugs before they ship. Take automated screenshots of your app, get
              notified when they change, and compare with previous versions.
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
      </NavBody>
    </>
  )
}
