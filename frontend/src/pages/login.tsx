import { Typography, Box, Button, Container, Stack, Link } from "@mui/material"
import Head from "next/head"
import { useRouter } from "next/router"
import { type JSX, useEffect } from "react"

import { MarketingLayout } from "@/components/NavBody"
import { Seo } from "@/components/Seo"
import useAuth from "@/hooks/useAuth"
import { APP_URL } from "@/lib/environment"

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

  function signIn(): void {
    const origin = typeof window !== "undefined" ? window.location.origin : APP_URL
    window.location.href = `${origin}/api/auth/login?redirect=${encodeURIComponent(redirectUri)}`
  }

  // Don't show login page content while checking auth status
  if (isLoading || user) {
    return (
      <>
        <Seo title="VizDiff: Login" canonical="https://vizdiff.io/login"></Seo>
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
                fontWeight: 600,
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
            <Typography variant="body1" sx={{ mb: 3, maxWidth: "400px" }}>
              Sign in to view your repositories, storybook builds, and review and approve screenshot
              changes.
            </Typography>
            <Stack direction="column" spacing={2} sx={{ alignItems: "flex-start" }}>
              <Button variant="contained" size="large" onClick={signIn} sx={{ px: 4, py: 1 }}>
                Sign in
              </Button>
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
