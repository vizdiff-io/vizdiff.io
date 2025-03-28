import { datadogRum } from "@datadog/browser-rum"
import { createContext, useContext, useEffect, useState } from "react"

import { tryApiGet } from "@/lib/apiMethods"
import type { UserResponse } from "@/lib/apiTypes"

const API_ME_URL = "/api/users/me"

interface AuthContextType {
  user: UserResponse | null
  isLoading: boolean
  error: Error | null
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchUser() {
      const [userData, apiError] = await tryApiGet<UserResponse>(API_ME_URL)
      setUser(userData)
      setIsLoading(false)
      if (apiError) {
        setError(apiError)
      } else if (userData) {
        // Associate this session with the user in Datadog RUM
        datadogRum.setUser({
          id: userData.id.toString(),
          name: userData.githubUsername,
          email: userData.email ?? undefined,
        })
      }
    }

    void fetchUser()
  }, [])

  return <AuthContext.Provider value={{ user, isLoading, error }}>{children}</AuthContext.Provider>
}

export default function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
