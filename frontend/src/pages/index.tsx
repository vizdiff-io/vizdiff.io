import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome"
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline"
import CompareArrowsIcon from "@mui/icons-material/CompareArrows"
import LinkIcon from "@mui/icons-material/Link"
import { Box, Button, Container, Grid, Link as MuiLink, Typography } from "@mui/material"
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
      {/* How it Works Section */}
      <Box sx={{ py: { xs: 4, md: 12 }, bgcolor: "var(--bg-paper)" }}>
        <Container maxWidth="lg">
          <Typography variant="h2" align="center" sx={{ mb: { xs: 4, sm: 6 } }}>
            How VizDiff Works
          </Typography>
          <Grid container spacing={{ xs: 4, md: 6 }} justifyContent="center">
            {/* Step 1: Connect */}
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Box sx={{ textAlign: "center" }}>
                <LinkIcon sx={{ fontSize: 40, mb: 2, color: "primary.main" }} />
                <Typography variant="h5" sx={{ mb: 1 }}>
                  1. Connect Repository
                </Typography>
                <Typography variant="body1">
                  Link your GitHub repository and upload your first Storybook build. Setup takes
                  minutes.
                </Typography>
              </Box>
            </Grid>
            {/* Step 2: Automate */}
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Box sx={{ textAlign: "center" }}>
                <AutoAwesomeIcon sx={{ fontSize: 40, mb: 2, color: "primary.main" }} />
                <Typography variant="h5" sx={{ mb: 1 }}>
                  2. Automate Screenshots
                </Typography>
                <Typography variant="body1">
                  VizDiff captures screenshots automatically on every commit via a{" "}
                  <MuiLink
                    href="https://github.com/marketplace/actions/vizdiff-upload"
                    target="_blank"
                  >
                    GitHub Action
                  </MuiLink>
                  .
                </Typography>
              </Box>
            </Grid>
            {/* Step 3: Review Diffs */}
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Box sx={{ textAlign: "center" }}>
                <CompareArrowsIcon sx={{ fontSize: 40, mb: 2, color: "primary.main" }} />
                <Typography variant="h5" sx={{ mb: 1 }}>
                  3. Review Diffs
                </Typography>
                <Typography variant="body1">
                  Visually compare changes and approve or reject with a streamlined user interface.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  )
}
