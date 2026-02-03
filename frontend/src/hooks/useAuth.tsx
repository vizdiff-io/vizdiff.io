import { type JSX, createContext, useContext, useState, useCallback, useEffect } from "react"

import { setAnalyticsUser } from "@/lib/analytics"
import { tryApiGet } from "@/lib/apiMethods"
import type { UserResponse } from "@/lib/apiTypes"

const API_ME_URL = "/api/users/me"

interface AuthContextType {
  user: UserResponse | null
  isLoading: boolean
  error: Error | null
  fetchUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchUser = useCallback(async () => {
    if (isLoading || user) {
      return
    }

    setIsLoading(true)
    setError(null)
    const [userData, apiError] = await tryApiGet<UserResponse>(API_ME_URL)
    setUser(userData)
    setIsLoading(false)
    if (apiError) {
      setError(apiError)
    }
  }, [isLoading, user])

  // Set analytics user whenever user data changes
  useEffect(() => {
    if (user) {
      setAnalyticsUser({
        id: user.id,
        name: user.githubUsername ?? user.gitlabUsername ?? undefined,
        email: user.email ?? undefined,
      })
    }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, isLoading, error, fetchUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export default function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
