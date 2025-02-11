import { Container, Typography, AppBar, Toolbar, Button, Box } from "@mui/material"
import { Inter } from "next/font/google"

import useAuth from "@/hooks/useAuth"

const inter = Inter({ subsets: ["latin"] })
void inter

interface MarketingLayoutProps {
  children: React.ReactNode
}

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children }) => {
  const { user, isLoading } = useAuth()

  return (
    <Box
      sx={{
        minHeight: "100vh",
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
            {isLoading ? (
              <Button disabled variant="text">
                Loading...
              </Button>
            ) : user ? (
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
