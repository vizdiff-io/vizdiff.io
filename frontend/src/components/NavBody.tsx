import MenuIcon from "@mui/icons-material/Menu"
import {
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Link,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from "@mui/material"
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
  const [anchorElNav, setAnchorElNav] = useState<null | HTMLElement>(null)

  useEffect(() => {
    const isAuthenticated = document.cookie.includes("authenticated=true")
    setIsClientAuthenticated(isAuthenticated)
    setIsClient(true)
  }, [])

  const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElNav(event.currentTarget)
  }
  const handleCloseNavMenu = () => {
    setAnchorElNav(null)
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        transition: "background-color 0.2s ease",
      }}
    >
      <AppBar position="static">
        <Toolbar
          sx={{
            pl: { xs: 0, sm: 4, md: 6 },
            pr: { xs: 1, sm: 4, md: 6 },
          }}
        >
          {/* Left side */}
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Box sx={{ display: { xs: "flex", sm: "none" }, mr: 1 }}>
              <IconButton
                size="large"
                aria-label="navigation menu"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleOpenNavMenu}
                color="inherit"
              >
                <MenuIcon />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorElNav}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "left",
                }}
                keepMounted
                transformOrigin={{
                  vertical: "top",
                  horizontal: "left",
                }}
                open={Boolean(anchorElNav)}
                onClose={handleCloseNavMenu}
                sx={{
                  display: { xs: "block", sm: "none" },
                }}
              >
                <MenuItem onClick={handleCloseNavMenu} component={Link} href="/pricing">
                  <Typography textAlign="center">Pricing</Typography>
                </MenuItem>
                <MenuItem onClick={handleCloseNavMenu} component={Link} href="/docs">
                  <Typography textAlign="center">Documentation</Typography>
                </MenuItem>
              </Menu>
            </Box>
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
              VizDiff
            </Typography>
            <Box sx={{ display: { xs: "none", sm: "flex" }, gap: 2 }}>
              <Link href={isClientAuthenticated ? "/signup" : "/pricing"}>
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
            <Box sx={{ display: "flex", gap: 2 }} />
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
                  <Button
                    href="/projects"
                    variant={isClientAuthenticated ? "contained" : "outlined"}
                    color="primary"
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    {isClientAuthenticated ? "Go to projects" : "Sign in"}
                  </Button>
                  {!isClientAuthenticated && (
                    <Button
                      href="/projects"
                      variant="contained"
                      sx={{
                        whiteSpace: "nowrap",
                        display: { xs: "none", sm: "inline-flex" },
                      }}
                    >
                      Get started
                    </Button>
                  )}
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
