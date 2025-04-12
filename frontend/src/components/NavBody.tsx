import { Container, Link, Typography, AppBar, Toolbar, Button, Box } from "@mui/material"
import { Inter } from "next/font/google"
import { useState, useEffect } from "react"

const inter = Inter({ subsets: ["latin"] })
void inter

interface MarketingLayoutProps {
  children: React.ReactNode
}

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children }) => {
  const [isClientAuthenticated, setIsClientAuthenticated] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    const isAuthenticated = document.cookie.includes("authenticated=true")
    setIsClientAuthenticated(isAuthenticated)
    setIsClient(true)
  }, [])

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
              <Link href="/pricing">
                <Button color="primary" variant="text">
                  Pricing
                </Button>
              </Link>
              <Link href="/docs">
                <Button color="primary" variant="text">
                  Documentation
                </Button>
              </Link>
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
            <Box
              sx={{
                display: "flex",
                gap: 2,
                opacity: isClient ? 1 : 0,
                transition: "opacity 0.3s ease-in-out",
              }}
            >
              {isClient && (
                <>
                  {!isClientAuthenticated && (
                    <Button href="/projects" variant="outlined">
                      Sign in
                    </Button>
                  )}
                  <Button href="/projects" variant="contained" color="primary">
                    {isClientAuthenticated ? "Go to projects" : "Get started"}
                  </Button>
                </>
              )}
            </Box>
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
