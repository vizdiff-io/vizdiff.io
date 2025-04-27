import type { Endpoints } from "@octokit/types"
import type { Meta, StoryObj } from "@storybook/react"
import { http, HttpResponse } from "msw"
import type { JSX, ComponentType } from "react"

import ThemeWrapper from "./ThemeWrapper"
import { avatar01 } from "./assets"
import { catchAllHandler, userHandler } from "./mocks"
import NewProjectDialog from "../components/NewProjectDialog"

const BASE_ORG_DATA = {
  node_id: "MDEyOk9yZ2FuaXphdGlvbjE=",
  url: "",
  repos_url: "",
  events_url: "",
  hooks_url: "",
  issues_url: "",
  members_url: "",
  public_members_url: "",
  avatar_url: "",
  description: "",
}

const BASE_REPO_DATA = {
  id: 1,
  node_id: "MDEwOlJlcG9zaXRvcnkx",
  name: "vizdiff.io",
  full_name: "vizdiff-io/vizdiff.io",
  private: false,
  owner: {
    login: "vizdiff-io",
    id: 1,
    node_id: "MDQ6VXNlcjE=",
    avatar_url: avatar01.src,
    gravatar_id: "",
    url: "https://api.github.com/users/vizdiff-io",
    html_url: "https://github.com/vizdiff-io",
    followers_url: "https://api.github.com/users/vizdiff-io/followers",
    following_url: "https://api.github.com/users/vizdiff-io/following{/other_user}",
    gists_url: "https://api.github.com/users/vizdiff-io/gists{/gist_id}",
    starred_url: "https://api.github.com/users/vizdiff-io/starred{/owner}{/repo}",
    subscriptions_url: "https://api.github.com/users/vizdiff-io/subscriptions",
    organizations_url: "https://api.github.com/users/vizdiff-io/orgs",
    repos_url: "https://api.github.com/users/vizdiff-io/repos",
    events_url: "https://api.github.com/users/vizdiff-io/events{/privacy}",
    received_events_url: "https://api.github.com/users/vizdiff-io/received_events",
    type: "User",
    site_admin: false,
  },
  html_url: "https://github.com/vizdiff-io/vizdiff.io",
  description: "Visual diff testing platform",
  fork: false,
  url: "https://api.github.com/repos/vizdiff-io/vizdiff.io",
  forks_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/forks",
  keys_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/keys{/key_id}",
  collaborators_url: "https://api.github.com/repos/vizdiff/vizdiff.io/collaborators{/collaborator}",
  teams_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/teams",
  hooks_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/hooks",
  issue_events_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/issues/events{/number}",
  events_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/events",
  assignees_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/assignees{/user}",
  branches_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/branches{/branch}",
  tags_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/tags",
  blobs_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/git/blobs{/sha}",
  git_tags_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/git/tags{/sha}",
  git_refs_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/git/refs{/sha}",
  trees_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/git/trees{/sha}",
  statuses_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/statuses/{sha}",
  languages_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/languages",
  stargazers_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/stargazers",
  contributors_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/contributors",
  subscribers_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/subscribers",
  subscription_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/subscription",
  commits_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/commits{/sha}",
  git_commits_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/git/commits{/sha}",
  comments_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/comments{/number}",
  issue_comment_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/issues/comments{/number}",
  contents_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/contents/{+path}",
  compare_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/compare/{base}...{head}",
  merges_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/merges",
  archive_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/{archive_format}{/ref}",
  downloads_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/downloads",
  issues_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/issues{/number}",
  pulls_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/pulls{/number}",
  milestones_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/milestones{/number}",
  notifications_url:
    "https://api.github.com/repos/vizdiff-io/vizdiff.io/notifications{?since,all,participating}",
  labels_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/labels{/name}",
  releases_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/releases{/id}",
  deployments_url: "https://api.github.com/repos/vizdiff-io/vizdiff.io/deployments",
}

// Mock data for GitHub organizations
const mockOrgs: Endpoints["GET /user/orgs"]["response"]["data"] = [
  { id: 1, login: "pixel-ada", ...BASE_ORG_DATA },
  { id: 2, login: "vizdiff-io", ...BASE_ORG_DATA },
  { id: 3, login: "nodejs", ...BASE_ORG_DATA },
  { id: 4, login: "electron", ...BASE_ORG_DATA },
  { id: 5, login: "mui", ...BASE_ORG_DATA },
  { id: 6, login: "storybookjs", ...BASE_ORG_DATA },
  { id: 7, login: "fastapi", ...BASE_ORG_DATA },
  { id: 8, login: "axios", ...BASE_ORG_DATA },
  { id: 9, login: "expressjs", ...BASE_ORG_DATA },
  { id: 10, login: "fastapi", ...BASE_ORG_DATA },
  { id: 11, login: "kubernetes", ...BASE_ORG_DATA },
  { id: 12, login: "puppeteer", ...BASE_ORG_DATA },
  { id: 13, login: "tailwindlabs", ...BASE_ORG_DATA },
  { id: 14, login: "nvm-sh", ...BASE_ORG_DATA },
]

// Mock data for GitHub repositories
const mockVizdiffRepos: Endpoints["GET /orgs/{org}/repos"]["response"]["data"] = [
  { ...BASE_REPO_DATA },
  { ...BASE_REPO_DATA, id: 2, name: "cli", full_name: "vizdiff-io/cli" },
  { ...BASE_REPO_DATA, id: 3, name: "upload-action", full_name: "vizdiff-io/upload-action" },
]

const meta: Meta<typeof NewProjectDialog> = {
  title: "stories/components/NewProjectDialog",
  component: NewProjectDialog,
  decorators: [
    (Story: ComponentType): JSX.Element => {
      // Set authentication cookie for Storybook
      document.cookie = "authenticated=true; path=/"
      return (
        <ThemeWrapper mode="light">
          <Story />
        </ThemeWrapper>
      )
    },
  ],
  parameters: {
    msw: {
      handlers: [userHandler, catchAllHandler],
    },
  },
}

export default meta

type Story = StoryObj<typeof NewProjectDialog>

export const Empty: Story = {
  args: {},
  parameters: {
    msw: {
      handlers: [
        userHandler,
        http.get("/api/github/orgs", () => HttpResponse.json([])),
        catchAllHandler,
      ],
    },
  },
}

export const Loading: Story = {
  args: {},
  parameters: {
    msw: {
      handlers: [
        userHandler,
        // Delay response to simulate slow loading state
        http.get("/api/github/orgs", async () => {
          await new Promise((resolve) => setTimeout(resolve, 3000))
          return HttpResponse.json(mockOrgs)
        }),
        catchAllHandler,
      ],
    },
  },
}

export const LoadingRepos: Story = {
  args: {
    initialSelectedOrg: "vizdiff",
  },
  parameters: {
    msw: {
      handlers: [
        userHandler,
        http.get("/api/github/orgs", () => HttpResponse.json(mockOrgs)),
        // Delay response to simulate slow loading state for repos
        http.get("/api/github/repos", async ({ request }) => {
          const url = new URL(request.url)
          const org = url.searchParams.get("org")

          if (org === "vizdiff") {
            await new Promise((resolve) => setTimeout(resolve, 3000))
            return HttpResponse.json(mockVizdiffRepos)
          }

          return HttpResponse.json([])
        }),
        catchAllHandler,
      ],
    },
  },
}

export const OrgsView: Story = {
  args: {},
  parameters: {
    msw: {
      handlers: [
        userHandler,
        http.get("/api/github/orgs", () => HttpResponse.json(mockOrgs)),
        http.get("/api/github/repos", ({ request }) => {
          const url = new URL(request.url)
          const org = url.searchParams.get("org")

          if (org === "vizdiff") {
            return HttpResponse.json(mockVizdiffRepos)
          }

          return HttpResponse.json([])
        }),
        catchAllHandler,
      ],
    },
  },
}

export const ReposView: Story = {
  args: {
    initialSelectedOrg: "vizdiff",
  },
  parameters: {
    msw: {
      handlers: [
        userHandler,
        http.get("/api/github/orgs", () => HttpResponse.json(mockOrgs)),
        http.get("/api/github/repos", ({ request }) => {
          const url = new URL(request.url)
          const org = url.searchParams.get("org")

          if (org === "vizdiff") {
            return HttpResponse.json(mockVizdiffRepos)
          }

          return HttpResponse.json([])
        }),
        catchAllHandler,
      ],
    },
  },
}
