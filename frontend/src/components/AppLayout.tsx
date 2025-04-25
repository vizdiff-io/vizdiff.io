import {
  Container,
  AppBar,
  Toolbar,
  Button,
  Box,
  Avatar,
  Breadcrumbs,
  type SxProps,
  Link,
} from "@mui/material"
import { Inter } from "next/font/google"
import { useEffect, useState, useMemo } from "react"

import useAuth from "@/hooks/useAuth"
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs"

import ProtectedRoute from "./ProtectedRoute"

const inter = Inter({ subsets: ["latin"] })
void inter

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
          pl: 0,
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
        <AppBar position="static">
          <Toolbar sx={{ px: { xs: 2, sm: 4, md: 6 } }}>
            {/* Left side */}
            <Box sx={{ display: "flex", alignItems: "center" }}>
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

            {/* Right side */}
            <Box sx={{ flexGrow: 1 }} />
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              {trialDaysLeft != undefined && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    px: 2,
                    py: 1,
                    borderRadius: 1,
                    backgroundColor: "var(--bg-paper)",
                    color: "var(--text-primary)",
                  }}
                >
                  <Box sx={{ fontSize: "0.875rem" }}>
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
    </ProtectedRoute>
  )
}
