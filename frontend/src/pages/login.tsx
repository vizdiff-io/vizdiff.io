import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline"
import GitHubIcon from "@mui/icons-material/GitHub"
import { Typography, Box, Button, Container, Stack, Link } from "@mui/material"
import Head from "next/head"
import { useRouter } from "next/router"
import { type JSX, useEffect } from "react"

import { MarketingLayout } from "@/components/NavBody"
import useAuth from "@/hooks/useAuth"
import { githubSignIn } from "@/lib/apiMethods"
import { APP_URL, GITHUB_APP_NAME, GITHUB_CLIENT_ID } from "@/lib/environment"

export default function Login(): JSX.Element {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  // Get the redirect URL from the query string
  const { redirect } = router.query
  const redirectUri = redirect && typeof redirect === "string" ? redirect : `${APP_URL}/projects`

  // Redirect to the URL given in ?redirect=<URL> if the user is already logged in
  useEffect(() => {
    if (!isLoading && user && router.isReady) {
      void router.replace(redirectUri)
    }
  }, [user, isLoading, router, router.isReady, redirectUri])

  if (!GITHUB_APP_NAME || !GITHUB_CLIENT_ID) {
    return (
      <MarketingLayout>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: "center", pt: { xs: 8, sm: 12, md: 16 }, pb: { xs: 8, sm: 12 } }}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
              <ErrorOutlineIcon sx={{ fontSize: 24, color: "error.main" }} />
              <Typography variant="h6">Login is not configured</Typography>
            </Stack>
          </Box>
        </Container>
      </MarketingLayout>
    )
  }

  // Don't show login page content while checking auth status
  if (isLoading || user) {
    return (
      <>
        <Head>
          <title>Login - vizdiff.io</title>
          <meta name="description" content="Login to vizdiff.io" />
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
              <Typography variant="h6">Redirecting...</Typography>
            </Box>
          </Container>
        </MarketingLayout>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Login - vizdiff.io</title>
        <meta name="description" content="Login to vizdiff.io" />
      </Head>
      <MarketingLayout>
        <Container maxWidth="lg">
          <Box
            sx={{
              textAlign: "left",
              pt: { xs: 0, sm: 12, md: 16 },
              pb: { xs: 8, sm: 12 },
              maxWidth: "800px",
            }}
          >
            <Typography
              component="h1"
              sx={{
                mb: 2,
                fontSize: { xs: "h4.fontSize", sm: "h1.fontSize" },
                lineHeight: 1.2,
                background: "var(--gradient-text)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Sign in to{" "}
              <Box component="span" sx={{ color: "primary.main", WebkitTextFillColor: "#5cc5ff" }}>
                vizdiff.io
              </Box>
            </Typography>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={4}
              sx={{
                maxWidth: { xs: "400px", md: "100%" },
                "& > *": { flex: "1 1 0", maxWidth: { md: "400px" } },
                alignItems: "stretch",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Box flex="1">
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    Sign in to view your repositories, storybook builds, and review and approve
                    screenshot changes.
                  </Typography>
                </Box>
                <Box sx={{ pt: 3 }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => githubSignIn(redirectUri)}
                    startIcon={<GitHubIcon />}
                    sx={{
                      bgcolor: "white",
                      color: "black",
                      "&:hover": {
                        bgcolor: "#f5f5f5",
                      },
                      boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                    }}
                  >
                    Sign in with GitHub
                  </Button>
                </Box>
              </Box>
            </Stack>

            <Typography variant="body2" color="var(--seventy-percent-opacity)" sx={{ mt: 4 }}>
              By signing in, you agree to our{" "}
              <Link href="/docs/terms-of-service">Terms of Service</Link> and{" "}
              <Link href="/docs/privacy-policy">Privacy Policy</Link>.
            </Typography>
          </Box>
        </Container>
      </MarketingLayout>
    </>
  )
}
