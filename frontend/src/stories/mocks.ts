import { http, HttpResponse, passthrough } from "msw"

import type { UserResponse } from "@/lib/apiTypes"

import { avatar01 } from "./assets"

const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60
const fixedDate = new Date("2025-04-01T08:00:00Z")

// Default user: OIDC / MSAL identity (the GitLab-mode default). No GitHub account linkage, so the
// account page shows name + email only.
export const mockUser: UserResponse = {
  id: 123,
  email: "test@example.com",
  displayName: "Test User",
  authProvider: "oidc",
  ownedProjectCount: 2,
  createdStampSec: fixedDate.getTime() / 1000,
  updatedStampSec: oneMinuteAgo,
  githubId: null,
  githubUsername: null,
  githubProfile: null,
  githubInstallations: [],
}

// GitHub-mode user: authenticated via GitHub (AUTH_PROVIDER=github) with a linked GitHub account.
export const mockGitHubUser: UserResponse = {
  ...mockUser,
  authProvider: "github",
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
}

export const userHandler = http.get("/api/users/me", () => HttpResponse.json(mockUser))
export const githubUserHandler = http.get("/api/users/me", () => HttpResponse.json(mockGitHubUser))

export const catchAllHandler = http.all("*", ({ request }) => {
  const url = new URL(request.url)
  if (url.pathname.startsWith("/api/")) {
    console.warn(`Unhandled API request in Storybook: ${request.method} ${request.url}`)
    return HttpResponse.json({ error: "Unhandled API request" }, { status: 500 })
  }
  return passthrough()
})
