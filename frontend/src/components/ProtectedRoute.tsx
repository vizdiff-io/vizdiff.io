import { type JSX, useEffect, useState } from "react"

import useAuth from "@/hooks/useAuth"
import { isAuthenticated, redirectToLogin } from "@/lib/apiMethods"

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode
}): JSX.Element | null {
  const { user, isLoading, fetchUser } = useAuth()
  const [isClient, setIsClient] = useState(false)
  const [fetchAttempted, setFetchAttempted] = useState(false)

  useEffect(() => {
    setIsClient(true)

    // Check authentication status client-side
    const authenticated = isAuthenticated()

    if (!authenticated) {
      // If not authenticated via cookie, redirect to login (user chooses GitHub or GitLab)
      redirectToLogin(window.location.href)
    } else if (!user && !isLoading && !fetchAttempted) {
      // If authenticated via cookie but no user data yet, and not attempted yet
      setFetchAttempted(true)
      void fetchUser()
    }
    // Depend on fetchUser, isLoading, and user to re-run if needed
  }, [fetchUser, user, isLoading, fetchAttempted])

  // Still loading user data from API?
  if (isLoading) {
    return null // Or a loading spinner
  }

  // If still no user after checking/loading...
  if (!user) {
    // If we are on the client, the fetch was attempted (meaning the cookie check passed initially),
    // but it failed (user is null), then the session is invalid. Redirect to login.
    if (isClient && fetchAttempted) {
      redirectToLogin(window.location.href)
      return null // Return null immediately after initiating redirect
    }

    // Otherwise (e.g., before useEffect runs, or if fetch wasn't attempted for some reason),
    // continue showing nothing. The useEffect handles the primary redirect logic.
    return null
  }

  // If we reach here, user is authenticated and data is loaded
  return <>{children}</>
}
