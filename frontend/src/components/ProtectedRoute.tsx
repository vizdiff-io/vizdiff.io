import { useRouter } from "next/router"
import { useEffect, useState } from "react"

import useAuth from "@/hooks/useAuth"
import { githubSignIn, isAuthenticated } from "@/lib/apiMethods"

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode
}): JSX.Element | null {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)

    // Fast-path cookie check before the API finishes
    if (!isAuthenticated()) {
      githubSignIn(window.location.href)
    }
  }, [router])

  // If on server or still loading, show nothing
  if (!isClient || isLoading) {
    return null
  }

  // If no user after loading completes, it will be handled by the redirect in useEffect
  // This prevents any flash of protected content
  if (!user) {
    return null
  }

  return <>{children}</>
}
