import { Container, Typography, AppBar, Toolbar, Button, Box } from "@mui/material"
import { Inter } from "next/font/google"

import useTryApiGet from "@/hooks/useTryApiGet"
import theme from "@/lib/theme"

const API_ME_URL = "/api/users/me"

const inter = Inter({ subsets: ["latin"] })
void inter

interface NavBodyProps {
  children: React.ReactNode
}

interface User {
  githubUsername: string
}

export const NavBody: React.FC<NavBodyProps> = ({ children }) => {
  const [me, isMeLoading, _] = useTryApiGet<User>(API_ME_URL)

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: theme.palette.background.default,
        display: "flex",
        flexDirection: "column",
        transition: "background-color 0.2s ease",
      }}
    >
      <AppBar position="static">
        <Toolbar sx={{ px: { xs: 2, sm: 4, md: 6 } }}>
          {/* Left side */}
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Typography
              variant="h6"
              component="a"
              href="/"
              sx={{
                fontWeight: 600,
                fontSize: "1.25rem",
                color: theme.palette.text.primary,
                textDecoration: "none",
                mr: 4,
              }}
            >
              vizdiff.io
            </Typography>
            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 2 }}>
              <Button color="primary" variant="text">
                Product
              </Button>
              <Button color="primary" variant="text">
                Pricing
              </Button>
              <Button color="primary" variant="text">
                Documentation
              </Button>
            </Box>
          </Box>

          {/* Right side */}
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: "flex", gap: 2 }}>
            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 2 }}>
              {/* <Button color="primary" variant="text">
                Documentation
              </Button> */}
            </Box>
            {isMeLoading ? (
              <Button disabled variant="text">
                Loading...
              </Button>
            ) : me ? (
              <Button href="/api/auth/logout" variant="outlined">
                Logout
              </Button>
            ) : (
              <>
                <Button href="/projects" variant="outlined">
                  Sign in
                </Button>
                <Button href="/projects" variant="contained" color="primary">
                  Get started
                </Button>
              </>
            )}
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        sx={{
          flex: 1,
          bgcolor: theme.palette.background.default,
          transition: "background-color 0.2s ease",
        }}
      >
        <Container maxWidth="lg" sx={{ py: 4 }}>
          {children}
        </Container>
      </Box>
    </Box>
  )
}
