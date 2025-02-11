import GitHubIcon from "@mui/icons-material/GitHub"
import { Typography, Box, Button, Container } from "@mui/material"
import Head from "next/head"
import { useRouter } from "next/router"
import { useEffect } from "react"

import { NavBody } from "@/components/NavBody"
import useAuth from "@/hooks/useAuth"

const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID
const callbackUri = encodeURIComponent(
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`,
)
const scope = "repo,read:org"

export default function Login(): JSX.Element {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  // Get the redirect URL from the query string
  const { redirect } = router.query
  const redirectUri =
    redirect && typeof redirect === "string"
      ? redirect
      : `${process.env.NEXT_PUBLIC_APP_URL!}/projects`
  const state = encodeURIComponent(`redirect=${encodeURIComponent(redirectUri)}`)

  // Redirect to the URL given in ?redirect=<URL> if the user is already logged in
  useEffect(() => {
    if (!isLoading && user) {
      void router.replace(redirectUri)
    }
  }, [user, isLoading, router, redirectUri])

  const handleConnectToGitHub = () => {
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${callbackUri}&scope=${scope}&state=${state}`
    void router.push(authUrl)
  }

  // Don't show login page content while checking auth status
  if (isLoading || user) {
    return (
      <>
        <Head>
          <title>Login - vizdiff.io</title>
          <meta name="description" content="Login to vizdiff.io" />
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
              <Typography variant="h6">Redirecting...</Typography>
            </Box>
          </Container>
        </NavBody>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Login - vizdiff.io</title>
        <meta name="description" content="Login to vizdiff.io" />
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
              vizdiff.io connects to your GitHub account to enable screenshot testing for your
              repositories.
            </Typography>
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleConnectToGitHub}
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
        </Container>
      </NavBody>
    </>
  )
}
