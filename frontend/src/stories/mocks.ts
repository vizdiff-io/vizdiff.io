import { http, HttpResponse } from "msw"

import type { UserResponse } from "@/lib/apiTypes"

const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60
const mockUser: UserResponse = {
  id: 123,
  githubId: "123",
  email: "test@example.com",
  githubUsername: "testuser",
  githubProfile: {
    login: "testuser",
  },
  createdStampSec: oneMinuteAgo,
  updatedStampSec: oneMinuteAgo,
}

export const userHandler = http.get("/api/users/me", () => HttpResponse.json({ mockUser }))
