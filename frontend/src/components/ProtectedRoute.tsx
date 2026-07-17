import { Box, Button, Typography } from "@mui/material"
import { AxiosError } from "axios"
import { type JSX, useEffect, useState } from "react"

import useAuth from "@/hooks/useAuth"
import { isAuthenticated, redirectToLogin } from "@/lib/apiMethods"

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode
}): JSX.Element | null {
  const { user, isLoading, error, fetchUser } = useAuth()
  const [fetchAttempted, setFetchAttempted] = useState(false)

  useEffect(() => {
    // Check authentication status client-side
    if (!isAuthenticated()) {
      // If not authenticated via cookie, redirect to login (user chooses GitHub or GitLab)
      redirectToLogin(window.location.href)
      return
    }

    if (!user && !isLoading && !fetchAttempted) {
      // If authenticated via cookie but no user data yet, and not attempted yet
      setFetchAttempted(true)
      void fetchUser()
    }
    // Depend on fetchUser, isLoading, and user to re-run if needed
  }, [fetchUser, user, isLoading, fetchAttempted])

  // The session is only known to be invalid when the API said so (401). Network blips and
  // server errors (5xx) must not bounce the user to login; they get a retry state below.
  const sessionInvalid = !user && error instanceof AxiosError && error.response?.status === 401

  // Redirect from an effect, not the render body: render-side redirects double-fire in
  // React StrictMode and run during render phases that may be thrown away.
  useEffect(() => {
    if (sessionInvalid) {
      redirectToLogin(window.location.href)
    }
  }, [sessionInvalid])

  // Still loading user data from API?
  if (isLoading) {
    return null // Or a loading spinner
  }

  if (!user) {
    // Fetching the user failed for a non-auth reason (network blip, 5xx): offer a retry
    // instead of kicking the user out of their session
    if (fetchAttempted && error && !sessionInvalid) {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, py: 8 }}>
          <Typography>Unable to verify your session. Check your connection and retry.</Typography>
          <Button variant="contained" onClick={() => setFetchAttempted(false)}>
            Retry
          </Button>
        </Box>
      )
    }

    // Otherwise (before the effect runs, while a login redirect is in flight, or on a 401),
    // render nothing. The effects above handle the redirect.
    return null
  }

  // If we reach here, user is authenticated and data is loaded
  return <>{children}</>
}
