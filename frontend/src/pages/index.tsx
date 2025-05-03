import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline"
import { Typography, Box, Button, Container, Link as MuiLink } from "@mui/material"
import type { JSX } from "react"

import { MarketingLayout } from "@/components/NavBody"
import { Seo } from "@/components/Seo"

export default function Home(): JSX.Element {
  return (
    <>
      <Seo canonical="https://vizdiff.io"></Seo>
      <MarketingLayout>
        <Container maxWidth="lg">
          <Box sx={{ position: "relative" }}>
            <Box
              sx={{
                textAlign: "left",
                pt: { xs: 0, sm: 12 },
                pb: { xs: 8, sm: 12 },
                maxWidth: "800px",
              }}
            >
              <Typography
                component="h1"
                variant="h1"
                sx={{
                  mb: 2,
                  fontSize: { xs: "h4.fontSize", sm: "h1.fontSize" },
                  background: "var(--gradient-text)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Check your work before merging with{" "}
                <Box
                  component="span"
                  sx={{ color: "primary.main", WebkitTextFillColor: "#5cc5ff" }}
                >
                  screenshot testing.
                </Box>
              </Typography>
              <Typography
                sx={{
                  mb: 4,
                  fontSize: { xs: "inherit", sm: "h6.fontSize" },
                  fontWeight: "normal",
                  lineHeight: 1.6,
                }}
              >
                Stop tedious manual UI checks. VizDiff automatically captures screenshots of your
                Storybook components and integrates with GitHub Checks to prevent visual regressions
                before they reach production. Ensure UI consistency across changes with minimal
                effort.
              </Typography>
              <Box sx={{ display: "flex", gap: 2 }}>
                <MuiLink href="/projects">
                  <Button variant="contained" color="primary" size="large">
                    Get started
                  </Button>
                </MuiLink>
                {/* <Button variant="outlined" size="large">
                  Get a demo
                </Button> */}
              </Box>
              <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <CheckCircleOutline sx={{ color: "var(--text-primary)", fontSize: "1rem" }} />
                  <Typography variant="body2" sx={{ color: "var(--text-primary)" }}>
                    14-day free trial
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <CheckCircleOutline sx={{ color: "var(--text-primary)", fontSize: "1rem" }} />
                  <Typography variant="body2" sx={{ color: "var(--text-primary)" }}>
                    No credit card required
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <CheckCircleOutline sx={{ color: "var(--text-primary)", fontSize: "1rem" }} />
                  <Typography variant="body2" sx={{ color: "var(--text-primary)" }}>
                    Cancel anytime
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Box
              component="img"
              src="/vizdiff-icon.svg"
              alt="VizDiff icon background"
              sx={{
                position: "absolute",
                top: 0,
                right: -120,
                width: "500px",
                height: "auto",
                opacity: { xs: 0, sm: 0.03, md: 0.05, lg: 0.15 },
                display: { xs: "none", sm: "block" },
                pointerEvents: "none",
              }}
            />
          </Box>
        </Container>
      </MarketingLayout>
    </>
  )
}
