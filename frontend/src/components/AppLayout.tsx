import MenuIcon from "@mui/icons-material/Menu"
import {
  Container,
  AppBar,
  Toolbar,
  Button,
  type ButtonProps,
  Box,
  Avatar,
  Breadcrumbs,
  type SxProps,
  Link,
  IconButton,
  Drawer,
  Divider,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material"
import { useRouter } from "next/router"
import React, { useEffect, useState, useMemo } from "react"

import useAuth from "@/hooks/useAuth"
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs"

import type { SidebarItem } from "./LeftSidebar"
import ProtectedRoute from "./ProtectedRoute"
import SidebarContent from "./SidebarContent"
import { AnalyticsEvents, trackEvent } from "../lib/analytics"

const drawerWidth = 240

interface AppLayoutProps {
  children: React.ReactNode
}

const breadcrumbNoLinkStyle: SxProps = {
  cursor: "default",
  "&:hover, &:active, &.Mui-focusVisible, &:focus": {
    background: "transparent",
    boxShadow: "none",
  },
  pointerEvents: "none",
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user } = useAuth()
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined)
  const { breadcrumbData } = useBreadcrumbs()
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()

  // Track initial sign-in events
  useEffect(() => {
    if (router.isReady && router.query.signed_in === "true") {
      trackEvent({
        action: AnalyticsEvents.SIGNED_IN,
        category: "Auth",
        label: "github_signin",
      })

      // Clean the URL by removing the query parameter without reloading the page
      // Use replace to avoid adding this intermediate state to the browser history
      const { signed_in, ...restQuery } = router.query
      void signed_in
      void router.replace(
        { pathname: router.pathname, query: restQuery },
        undefined, // Use undefined for 'as' path
        { shallow: true }, // Use shallow routing to prevent data fetching methods from re-running
      )
    }
  }, [router.isReady, router.query, router])

  // Update the avatar URL when the user changes
  useEffect(() => {
    const updateAvatarUrl = async () => {
      if (typeof user?.githubProfile.avatar_url === "string") {
        setAvatarUrl(user.githubProfile.avatar_url)
        return
      } else if (typeof user?.email === "string") {
        try {
          const encoder = new TextEncoder()
          const data = encoder.encode(user.email.toLowerCase().trim())
          const hashBuffer = await crypto.subtle.digest("SHA-256", data)
          const hashArray = Array.from(new Uint8Array(hashBuffer))
          const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
          setAvatarUrl(`https://www.gravatar.com/avatar/${hashHex}?d=mp&s=40`)
          return
        } catch (err) {
          console.error(err)
        }
      }

      // Set it to a default gravatar
      const ZERO_SHA256 = "0000000000000000000000000000000000000000000000000000000000000000"
      setAvatarUrl(`https://www.gravatar.com/avatar/${ZERO_SHA256}?d=mp&s=40`)
    }

    void updateAvatarUrl()
  }, [user])

  const breadcrumbs = useMemo(() => {
    const crumbs = [
      <Button
        color="primary"
        variant="text"
        key="1"
        href="/"
        sx={{
          fontWeight: 600,
          fontSize: "1.25rem",
          textDecoration: "none",
          mr: 3,
        }}
      >
        VizDiff
      </Button>,
      <Button color="primary" variant="text" key="2" href="/projects">
        Projects
      </Button>,
    ]

    if (breadcrumbData.projectId && breadcrumbData.projectName) {
      if (breadcrumbData.buildId) {
        crumbs.push(
          <Button
            color="primary"
            variant="text"
            key="3"
            href={`/project?id=${breadcrumbData.projectId}`}
          >
            {breadcrumbData.projectName}
          </Button>,
        )
        crumbs.push(
          <Button color="primary" variant="text" key="4" sx={breadcrumbNoLinkStyle}>
            Build #{breadcrumbData.buildNumber}
          </Button>,
        )
      } else {
        crumbs.push(
          <Button color="primary" variant="text" key="3" sx={breadcrumbNoLinkStyle}>
            {breadcrumbData.projectName}
          </Button>,
        )
      }
    }

    return crumbs
  }, [breadcrumbData])

  const trialDaysLeft = useMemo(() => {
    // Don't show the trial banner if the user failed to load, has an active
    // subscription, or doesn't own any projects
    if (!user || user.subscription || user.ownedProjectCount === 0) {
      return undefined
    }
    return Math.ceil((user.trialEndStampSec - Date.now() / 1000) / 86400)
  }, [user])

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const selectedSidebarItem = useMemo((): SidebarItem | undefined => {
    if (
      router.pathname.startsWith("/projects") ||
      router.pathname.startsWith("/project") ||
      router.pathname.startsWith("/build")
    ) {
      return "projects"
    }
    if (router.pathname.startsWith("/signup")) {
      return "billing"
    }
    if (router.pathname.startsWith("/settings")) {
      return "settings"
    }
    return undefined
  }, [router.pathname])

  return (
    <ProtectedRoute>
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          transition: "background-color 0.2s ease",
        }}
      >
        <AppBar
          position="fixed"
          sx={{
            zIndex: (theme) => theme.zIndex.drawer + 1,
            backgroundColor: "var(--bg-primary)",
          }}
        >
          <Toolbar
            sx={{
              pl: { xs: 2, sm: 4, md: 6 },
              pr: { xs: 1, sm: 4, md: 6 },
              minHeight: "56px !important",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", flexGrow: { xs: 1, md: 0 } }}>
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 0.5, display: { md: "none" } }}
              >
                <MenuIcon />
              </IconButton>
              <Button
                color="inherit"
                variant="text"
                key="1"
                href="/"
                sx={{
                  fontWeight: 600,
                  fontSize: "1.25rem",
                  textDecoration: "none",
                  px: 1,
                  display: { md: "none" },
                }}
              >
                VizDiff
              </Button>

              <Box sx={{ display: { xs: "none", md: "block" } }}>
                <Breadcrumbs
                  separator="›"
                  aria-label="breadcrumb"
                  sx={{
                    mr: 4,
                    "& .MuiBreadcrumbs-separator": { color: "var(--text-primary)", opacity: 0.5 },
                    "& a": { color: "var(--text-primary)", textDecoration: "none" },
                    "& a:hover": { textDecoration: "underline" },
                  }}
                >
                  {breadcrumbs}
                </Breadcrumbs>
              </Box>
            </Box>

            <Box sx={{ flexGrow: { xs: 0, md: 1 } }} />
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              {trialDaysLeft != undefined && (
                <Box
                  sx={{
                    display: { xs: "none", md: "flex" },
                    alignItems: "center",
                    gap: 2,
                    px: 2,
                    py: 1,
                    borderRadius: 1,
                    backgroundColor: "var(--bg-paper)",
                    color: "var(--text-primary)",
                  }}
                >
                  <Box sx={{ fontSize: "0.875rem", whiteSpace: "nowrap" }}>
                    {trialDaysLeft > 0
                      ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your free trial`
                      : "Your free trial has expired."}
                  </Box>
                  <Button color="primary" href="/signup" variant="contained" size="small">
                    {trialDaysLeft > 0 ? "Upgrade Now" : "Subscribe"}
                  </Button>
                </Box>
              )}
              {user && (
                <>
                  <Link href="/settings">
                    <Avatar
                      src={avatarUrl}
                      alt={user.githubUsername}
                      sx={{ width: 32, height: 32 }}
                    />
                  </Link>
                  <Button href="/api/auth/logout" variant="outlined" size="small">
                    Logout
                  </Button>
                </>
              )}
            </Box>
          </Toolbar>
        </AppBar>

        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth },
          }}
        >
          <Toolbar />
          <List>
            {breadcrumbs.toReversed().map((breadcrumb, index) => {
              if (React.isValidElement(breadcrumb) && breadcrumb.type === Button) {
                const { href, children: buttonChildren, sx } = breadcrumb.props as ButtonProps
                const isLink = typeof href === "string" && href.length > 0
                const isDisabled =
                  (sx as { pointerEvents?: string } | undefined)?.pointerEvents === "none"

                // "VizDiff" and "Projects" are already in the sidebar
                if (breadcrumb.key === "1" || breadcrumb.key === "2") {
                  return null
                }

                return (
                  <ListItemButton
                    key={index}
                    component={isLink ? Link : "div"}
                    href={href}
                    disabled={isDisabled}
                    onClick={handleDrawerToggle}
                    sx={isDisabled ? breadcrumbNoLinkStyle : {}}
                  >
                    <ListItemText primary={buttonChildren} />
                  </ListItemButton>
                )
              }
              return null
            })}
          </List>
          <Divider />
          <SidebarContent selectedItem={selectedSidebarItem} />
        </Drawer>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            mt: (theme) =>
              theme.mixins.toolbar.minHeight
                ? `calc(${theme.mixins.toolbar.minHeight}px + env(safe-area-inset-top))`
                : `calc(64px + env(safe-area-inset-top))`,
            transition: "background-color 0.2s ease",
          }}
        >
          <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
            {children}
          </Container>
        </Box>
      </Box>
    </ProtectedRoute>
  )
}
