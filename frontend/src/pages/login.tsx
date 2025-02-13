import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline"
import GitHubIcon from "@mui/icons-material/GitHub"
import { Typography, Box, Button, Container, Stack } from "@mui/material"
import Head from "next/head"
import { useRouter } from "next/router"
import { useEffect } from "react"

import { MarketingLayout } from "@/components/NavBody"
import useAuth from "@/hooks/useAuth"

const githubAppName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME
const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID
const githubAppUrl = `https://github.com/apps/${githubAppName}`
const callbackUri = encodeURIComponent(
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`,
)
const scope = "read:user,user:email"

export default function Login(): JSX.Element {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  // Get the redirect URL from the query string
  const { redirect } = router.query
  const redirectUri =
    redirect && typeof redirect === "string"
      ? redirect
      : `${process.env.NEXT_PUBLIC_APP_URL!}/projects`

  // Redirect to the URL given in ?redirect=<URL> if the user is already logged in
  useEffect(() => {
    if (!isLoading && user) {
      void router.replace(redirectUri)
    }
  }, [user, isLoading, router, redirectUri])

  const handleInstallApp = () => {
    // Direct them to install the GitHub App
    window.location.href = githubAppUrl
  }

  const handleSignIn = () => {
    // Just do the OAuth flow without app installation
    const state = encodeURIComponent(`redirect=${encodeURIComponent(redirectUri)}`)
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${callbackUri}&scope=${scope}&state=${state}`
    void router.push(authUrl)
  }

  if (!githubAppName || !clientId) {
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
              Sign in to{" "}
              <Box component="span" sx={{ color: "primary.main", WebkitTextFillColor: "#5cc5ff" }}>
                vizdiff.io
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
              Choose how you want to sign in:
            </Typography>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={4}
              sx={{
                maxWidth: { xs: "400px", md: "100%" },
                "& > *": { flex: "1 1 0", maxWidth: { md: "400px" } },
                minHeight: 240,
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
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Organization Admin
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    Install the GitHub App to enable screenshot testing for your repositories. This
                    will allow us to:
                  </Typography>
                  <Box component="ul" sx={{ mb: 2, ml: 3 }}>
                    <li>Get notified when a pull request is created or updated</li>
                    <li>Post GitHub Actions statuses</li>
                  </Box>
                </Box>
                <Box sx={{ pt: 3 }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleInstallApp}
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
                    Install GitHub App
                  </Button>
                </Box>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Box flex="1">
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Contributor
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    Sign in to review and approve screenshot changes in repositories where the
                    GitHub App is already installed.
                  </Typography>
                </Box>
                <Box sx={{ pt: 3 }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleSignIn}
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
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </Typography>
          </Box>
        </Container>
      </MarketingLayout>
    </>
  )
}
