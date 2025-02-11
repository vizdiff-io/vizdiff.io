import { Container, Typography, AppBar, Toolbar, Button, Box, Avatar } from "@mui/material"
import { Inter } from "next/font/google"
import { useEffect, useState } from "react"

import useAuth from "@/hooks/useAuth"

const inter = Inter({ subsets: ["latin"] })
void inter

interface AppLayoutProps {
  children: React.ReactNode
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user } = useAuth()
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined)

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
              href="/projects"
              sx={{
                fontWeight: 600,
                fontSize: "1.25rem",
                textDecoration: "none",
                mr: 4,
              }}
            >
              vizdiff.io
            </Typography>
          </Box>

          {/* Right side */}
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            {user && (
              <>
                <Avatar src={avatarUrl} alt={user.githubUsername} sx={{ width: 32, height: 32 }} />
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
  )
}
