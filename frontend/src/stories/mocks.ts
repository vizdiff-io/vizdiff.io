import { http, HttpResponse } from "msw"

import type { UserResponse } from "@/lib/apiTypes"

const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60
const fixedDate = new Date("2025-04-01T08:00:00Z")

export const mockUser: UserResponse = {
  id: 123,
  githubId: "456",
  email: "test@example.com",
  githubUsername: "testuser",
  githubProfile: {
    login: "testuser",
    name: "Test User",
    avatar_url: "https://placecats.com/millie/460/460",
    id: 0,
    node_id: "",
    email: null,
  },
  githubInstallations: [],
  ownedProjectCount: 2,
  subscription: {
    plan: "starter",
    interval: "monthly",
  },
  trialEndStampSec: oneMinuteAgo,
  createdStampSec: fixedDate.getTime() / 1000,
  updatedStampSec: oneMinuteAgo,
}

export const userHandler = http.get("/api/users/me", () => HttpResponse.json(mockUser))

export const catchAllHandler = http.all("/api/*", ({ request }) => {
  console.warn(`Unhandled API request in Storybook: ${request.method} ${request.url}`)
  return HttpResponse.json({ error: "Unhandled API request" }, { status: 500 })
})
