import { NavBody } from "@/components/NavBody"
import { useRouter } from "next/router"
import { Typography, Box, Button, Container } from "@mui/material"
import { useDarkMode } from "@/hooks/useDarkMode"
import Head from "next/head"
import GitHubIcon from "@mui/icons-material/GitHub"

const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID
const callbackUri = encodeURIComponent(
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`,
)
const scope = "repo,read:org"

export default function Login() {
  const router = useRouter()
  const isDarkMode = useDarkMode()

  // Get the redirect URL from the query string
  const { redirect } = router.query
  const redirectUri =
    typeof redirect === "string" ? redirect : String(process.env.NEXT_PUBLIC_APP_URL)
  const state = encodeURIComponent(`redirect=${encodeURIComponent(redirectUri)}`)

  const handleConnectToGitHub = () => {
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${callbackUri}&scope=${scope}&state=${state}`
    router.push(authUrl)
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
                background: isDarkMode
                  ? "linear-gradient(to right, #fff 60%, rgba(255,255,255,0.5))"
                  : "linear-gradient(to right, #000 60%, rgba(0,0,0,0.5))",
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
                color: "text.secondary",
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
                  boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
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
