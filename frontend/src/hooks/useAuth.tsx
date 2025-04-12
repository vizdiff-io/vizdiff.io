import { datadogRum } from "@datadog/browser-rum"
import { createContext, useContext, useState, useCallback } from "react"

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
    } else if (userData) {
      datadogRum.setUser({
        id: userData.id.toString(),
        name: userData.githubUsername,
        email: userData.email ?? undefined,
      })
    }
  }, [isLoading, user])

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
