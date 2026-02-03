import { http, HttpResponse, passthrough } from "msw"

import type { UserResponse } from "@/lib/apiTypes"

import { avatar01 } from "./assets"

const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60
const fixedDate = new Date("2025-04-01T08:00:00Z")

export const mockUser: UserResponse = {
  id: 123,
  email: "test@example.com",
  ownedProjectCount: 2,
  subscription: {
    plan: "starter",
    interval: "monthly",
  },
  trialEndStampSec: oneMinuteAgo,
  createdStampSec: fixedDate.getTime() / 1000,
  updatedStampSec: oneMinuteAgo,
  // GitHub fields
  githubId: "456",
  githubUsername: "testuser",
  githubProfile: {
    login: "testuser",
    name: "Test User",
    avatar_url: avatar01.src,
    id: 0,
    node_id: "",
    email: null,
  },
  githubInstallations: [],
  // GitLab fields (null for GitHub-only user)
  gitlabId: null,
  gitlabUsername: null,
  gitlabProfile: null,
  gitlabGroups: [],
}

export const userHandler = http.get("/api/users/me", () => HttpResponse.json(mockUser))

export const catchAllHandler = http.all("*", ({ request }) => {
  const url = new URL(request.url)
  if (url.pathname.startsWith("/api/")) {
    console.warn(`Unhandled API request in Storybook: ${request.method} ${request.url}`)
    return HttpResponse.json({ error: "Unhandled API request" }, { status: 500 })
  }
  return passthrough()
})
