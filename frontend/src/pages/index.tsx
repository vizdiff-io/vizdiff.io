import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome"
import CompareArrowsIcon from "@mui/icons-material/CompareArrows"
import GroupsIcon from "@mui/icons-material/Groups"
import IntegrationInstructionsIcon from "@mui/icons-material/IntegrationInstructions"
import LinkIcon from "@mui/icons-material/Link"
import VisibilityIcon from "@mui/icons-material/Visibility"
import { Box, Button, Container, Grid, Link as MuiLink, Typography } from "@mui/material"
import type { JSX } from "react"

import { GitLabIcon } from "@/components/GitLabIcon"
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
                Storybook components and integrates with GitLab merge requests to prevent visual
                regressions before they reach production. Ensure UI consistency across changes with
                minimal effort.
              </Typography>
              <Box sx={{ display: "flex", gap: 2 }}>
                <MuiLink href="/projects">
                  <Button variant="contained" color="primary" size="large">
                    Go to projects
                  </Button>
                </MuiLink>
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
              <Box
                sx={{
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                <Box sx={{ mb: 5 }}>
                  <LinkIcon sx={{ fontSize: 40, mb: 2, color: "primary.main" }} />
                  <Typography variant="h5" sx={{ mb: 1 }}>
                    1. Connect Repository
                  </Typography>
                  <Typography variant="body1">
                    Link your GitLab project and upload your first Storybook build. Setup takes
                    minutes.
                  </Typography>
                </Box>
              </Box>
            </Grid>
            {/* Step 2: Automate */}
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Box
                sx={{
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                <Box sx={{ mb: 5 }}>
                  <AutoAwesomeIcon sx={{ fontSize: 40, mb: 2, color: "primary.main" }} />
                  <Typography variant="h5" sx={{ mb: 1 }}>
                    2. Automate Screenshots
                  </Typography>
                  <Typography variant="body1">
                    VizDiff captures screenshots automatically on every commit via your GitLab CI
                    pipeline.
                  </Typography>
                </Box>
              </Box>
            </Grid>
            {/* Step 3: Review Diffs */}
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Box
                sx={{
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                <Box sx={{ mb: 5 }}>
                  <CompareArrowsIcon sx={{ fontSize: 40, mb: 2, color: "primary.main" }} />
                  <Typography variant="h5" sx={{ mb: 1 }}>
                    3. Review Diffs
                  </Typography>
                  <Typography variant="body1">
                    Visually compare changes and approve or reject with a streamlined user
                    interface.
                  </Typography>
                </Box>
                {/* Screenshot 3: Diff View */}
                <Box
                  sx={{
                    height: 250,
                    borderRadius: 1,
                    overflow: "hidden",
                    marginTop: "auto",
                  }}
                >
                  <Box
                    component="img"
                    src="/docs/details-diffview-900.png"
                    alt="VizDiff diff view UI comparing two screenshots"
                    sx={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                      borderRadius: 1,
                      border: "1px solid var(--bg-secondary)",
                    }}
                  />
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
      {/* Feature Highlights Section */}
      <Box sx={{ py: { xs: 8, sm: 12 }, bgcolor: "var(--bg-primary)" }}>
        <Container maxWidth="lg">
          <Typography variant="h2" align="center" sx={{ mb: { xs: 4, sm: 6 } }}>
            Key Features
          </Typography>
          <Grid container spacing={4} justifyContent="center">
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box sx={{ textAlign: "center" }}>
                <IntegrationInstructionsIcon sx={{ fontSize: 40, mb: 2, color: "primary.main" }} />
                <Typography variant="h5" sx={{ mb: 1 }}>
                  Storybook Integration
                </Typography>
                <Typography variant="body1">
                  Seamlessly tests components from your existing Storybook setup.
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box sx={{ textAlign: "center" }}>
                <GitLabIcon sx={{ fontSize: 40, mb: 2, color: "primary.main" }} />
                <Typography variant="h5" sx={{ mb: 1 }}>
                  GitLab Merge Requests
                </Typography>
                <Typography variant="body1">
                  Review and approve visual changes directly in your Merge Requests.
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box sx={{ textAlign: "center" }}>
                <VisibilityIcon sx={{ fontSize: 40, mb: 2, color: "primary.main" }} />
                <Typography variant="h5" sx={{ mb: 1 }}>
                  Pixel-Perfect Diffing
                </Typography>
                <Typography variant="body1">
                  Clearly highlights visual differences for quick identification.
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box sx={{ textAlign: "center" }}>
                <GroupsIcon sx={{ fontSize: 40, mb: 2, color: "primary.main" }} />
                <Typography variant="h5" sx={{ mb: 1 }}>
                  Team Collaboration
                </Typography>
                <Typography variant="body1">
                  Share baselines and review results easily across your team.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
      {/* Final CTA and Footer Links */}
      <Box sx={{ py: { xs: 6, sm: 10 }, textAlign: "center", bgcolor: "var(--bg-primary)" }}>
        <Container maxWidth="lg">
          <MuiLink href="/projects" sx={{ textDecoration: "none" }}>
            <Button variant="contained" color="primary" size="large">
              Go to projects
            </Button>
          </MuiLink>
        </Container>
      </Box>
    </>
  )
}
