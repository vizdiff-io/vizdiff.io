import type { Endpoints } from "@octokit/types"
import type { Meta, StoryObj } from "@storybook/react"
import { http, HttpResponse } from "msw"
import { type ComponentType } from "react"

import ThemeWrapper from "./ThemeWrapper"
import { userHandler } from "./mocks"
import NewProjectDialog from "../components/NewProjectDialog"

// Mock data for GitHub organizations
const mockOrgs: Endpoints["GET /user/orgs"]["response"]["data"] = [
  {
    login: "vizdiff",
    id: 1,
    node_id: "MDEyOk9yZ2FuaXphdGlvbjE=",
    url: "https://api.github.com/orgs/vizdiff",
    repos_url: "https://api.github.com/orgs/vizdiff/repos",
    events_url: "https://api.github.com/orgs/vizdiff/events",
    hooks_url: "https://api.github.com/orgs/vizdiff/hooks",
    issues_url: "https://api.github.com/orgs/vizdiff/issues",
    members_url: "https://api.github.com/orgs/vizdiff/members{/member}",
    public_members_url: "https://api.github.com/orgs/vizdiff/public_members{/member}",
    avatar_url: "https://placecats.com/millie/460/460",
    description: "Visual Diff Testing Platform",
  },
  {
    login: "metaverse-industries",
    id: 2,
    node_id: "MDEyOk9yZ2FuaXphdGlvbjI=",
    url: "https://api.github.com/orgs/metaverse-industries",
    repos_url: "https://api.github.com/orgs/metaverse-industries/repos",
    events_url: "https://api.github.com/orgs/metaverse-industries/events",
    hooks_url: "https://api.github.com/orgs/metaverse-industries/hooks",
    issues_url: "https://api.github.com/orgs/metaverse-industries/issues",
    members_url: "https://api.github.com/orgs/metaverse-industries/members{/member}",
    public_members_url: "https://api.github.com/orgs/metaverse-industries/public_members{/member}",
    avatar_url: "https://placecats.com/neo/460/460",
    description: "Building the metaverse",
  },
]

// Mock data for GitHub repositories
const mockVizdiffRepos: Endpoints["GET /orgs/{org}/repos"]["response"]["data"] = [
  {
    id: 1,
    node_id: "MDEwOlJlcG9zaXRvcnkx",
    name: "vizdiff.io",
    full_name: "vizdiff/vizdiff.io",
    private: false,
    owner: {
      login: "vizdiff",
      id: 1,
      node_id: "MDQ6VXNlcjE=",
      avatar_url: "https://placecats.com/millie/460/460",
      gravatar_id: "",
      url: "https://api.github.com/users/vizdiff",
      html_url: "https://github.com/vizdiff",
      followers_url: "https://api.github.com/users/vizdiff/followers",
      following_url: "https://api.github.com/users/vizdiff/following{/other_user}",
      gists_url: "https://api.github.com/users/vizdiff/gists{/gist_id}",
      starred_url: "https://api.github.com/users/vizdiff/starred{/owner}{/repo}",
      subscriptions_url: "https://api.github.com/users/vizdiff/subscriptions",
      organizations_url: "https://api.github.com/users/vizdiff/orgs",
      repos_url: "https://api.github.com/users/vizdiff/repos",
      events_url: "https://api.github.com/users/vizdiff/events{/privacy}",
      received_events_url: "https://api.github.com/users/vizdiff/received_events",
      type: "User",
      site_admin: false,
    },
    html_url: "https://github.com/vizdiff/vizdiff.io",
    description: "Visual diff testing platform",
    fork: false,
    url: "https://api.github.com/repos/vizdiff/vizdiff.io",
    forks_url: "https://api.github.com/repos/vizdiff/vizdiff.io/forks",
    keys_url: "https://api.github.com/repos/vizdiff/vizdiff.io/keys{/key_id}",
    collaborators_url:
      "https://api.github.com/repos/vizdiff/vizdiff.io/collaborators{/collaborator}",
    teams_url: "https://api.github.com/repos/vizdiff/vizdiff.io/teams",
    hooks_url: "https://api.github.com/repos/vizdiff/vizdiff.io/hooks",
    issue_events_url: "https://api.github.com/repos/vizdiff/vizdiff.io/issues/events{/number}",
    events_url: "https://api.github.com/repos/vizdiff/vizdiff.io/events",
    assignees_url: "https://api.github.com/repos/vizdiff/vizdiff.io/assignees{/user}",
    branches_url: "https://api.github.com/repos/vizdiff/vizdiff.io/branches{/branch}",
    tags_url: "https://api.github.com/repos/vizdiff/vizdiff.io/tags",
    blobs_url: "https://api.github.com/repos/vizdiff/vizdiff.io/git/blobs{/sha}",
    git_tags_url: "https://api.github.com/repos/vizdiff/vizdiff.io/git/tags{/sha}",
    git_refs_url: "https://api.github.com/repos/vizdiff/vizdiff.io/git/refs{/sha}",
    trees_url: "https://api.github.com/repos/vizdiff/vizdiff.io/git/trees{/sha}",
    statuses_url: "https://api.github.com/repos/vizdiff/vizdiff.io/statuses/{sha}",
    languages_url: "https://api.github.com/repos/vizdiff/vizdiff.io/languages",
    stargazers_url: "https://api.github.com/repos/vizdiff/vizdiff.io/stargazers",
    contributors_url: "https://api.github.com/repos/vizdiff/vizdiff.io/contributors",
    subscribers_url: "https://api.github.com/repos/vizdiff/vizdiff.io/subscribers",
    subscription_url: "https://api.github.com/repos/vizdiff/vizdiff.io/subscription",
    commits_url: "https://api.github.com/repos/vizdiff/vizdiff.io/commits{/sha}",
    git_commits_url: "https://api.github.com/repos/vizdiff/vizdiff.io/git/commits{/sha}",
    comments_url: "https://api.github.com/repos/vizdiff/vizdiff.io/comments{/number}",
    issue_comment_url: "https://api.github.com/repos/vizdiff/vizdiff.io/issues/comments{/number}",
    contents_url: "https://api.github.com/repos/vizdiff/vizdiff.io/contents/{+path}",
    compare_url: "https://api.github.com/repos/vizdiff/vizdiff.io/compare/{base}...{head}",
    merges_url: "https://api.github.com/repos/vizdiff/vizdiff.io/merges",
    archive_url: "https://api.github.com/repos/vizdiff/vizdiff.io/{archive_format}{/ref}",
    downloads_url: "https://api.github.com/repos/vizdiff/vizdiff.io/downloads",
    issues_url: "https://api.github.com/repos/vizdiff/vizdiff.io/issues{/number}",
    pulls_url: "https://api.github.com/repos/vizdiff/vizdiff.io/pulls{/number}",
    milestones_url: "https://api.github.com/repos/vizdiff/vizdiff.io/milestones{/number}",
    notifications_url:
      "https://api.github.com/repos/vizdiff/vizdiff.io/notifications{?since,all,participating}",
    labels_url: "https://api.github.com/repos/vizdiff/vizdiff.io/labels{/name}",
    releases_url: "https://api.github.com/repos/vizdiff/vizdiff.io/releases{/id}",
    deployments_url: "https://api.github.com/repos/vizdiff/vizdiff.io/deployments",
  },
  {
    id: 2,
    node_id: "MDEwOlJlcG9zaXRvcnky",
    name: "vizdiff-docs",
    full_name: "vizdiff/vizdiff-docs",
    private: false,
    owner: {
      login: "vizdiff",
      id: 1,
      node_id: "MDQ6VXNlcjE=",
      avatar_url: "https://placecats.com/millie/460/460",
      gravatar_id: "",
      url: "https://api.github.com/users/vizdiff",
      html_url: "https://github.com/vizdiff",
      followers_url: "https://api.github.com/users/vizdiff/followers",
      following_url: "https://api.github.com/users/vizdiff/following{/other_user}",
      gists_url: "https://api.github.com/users/vizdiff/gists{/gist_id}",
      starred_url: "https://api.github.com/users/vizdiff/starred{/owner}{/repo}",
      subscriptions_url: "https://api.github.com/users/vizdiff/subscriptions",
      organizations_url: "https://api.github.com/users/vizdiff/orgs",
      repos_url: "https://api.github.com/users/vizdiff/repos",
      events_url: "https://api.github.com/users/vizdiff/events{/privacy}",
      received_events_url: "https://api.github.com/users/vizdiff/received_events",
      type: "User",
      site_admin: false,
    },
    html_url: "https://github.com/vizdiff/vizdiff-docs",
    description: "Documentation for vizdiff.io",
    fork: false,
    url: "https://api.github.com/repos/vizdiff/vizdiff-docs",
    forks_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/forks",
    keys_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/keys{/key_id}",
    collaborators_url:
      "https://api.github.com/repos/vizdiff/vizdiff-docs/collaborators{/collaborator}",
    teams_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/teams",
    hooks_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/hooks",
    issue_events_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/issues/events{/number}",
    events_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/events",
    assignees_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/assignees{/user}",
    branches_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/branches{/branch}",
    tags_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/tags",
    blobs_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/git/blobs{/sha}",
    git_tags_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/git/tags{/sha}",
    git_refs_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/git/refs{/sha}",
    trees_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/git/trees{/sha}",
    statuses_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/statuses/{sha}",
    languages_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/languages",
    stargazers_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/stargazers",
    contributors_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/contributors",
    subscribers_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/subscribers",
    subscription_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/subscription",
    commits_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/commits{/sha}",
    git_commits_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/git/commits{/sha}",
    comments_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/comments{/number}",
    issue_comment_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/issues/comments{/number}",
    contents_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/contents/{+path}",
    compare_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/compare/{base}...{head}",
    merges_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/merges",
    archive_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/{archive_format}{/ref}",
    downloads_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/downloads",
    issues_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/issues{/number}",
    pulls_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/pulls{/number}",
    milestones_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/milestones{/number}",
    notifications_url:
      "https://api.github.com/repos/vizdiff/vizdiff-docs/notifications{?since,all,participating}",
    labels_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/labels{/name}",
    releases_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/releases{/id}",
    deployments_url: "https://api.github.com/repos/vizdiff/vizdiff-docs/deployments",
  },
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
}

export default meta

type Story = StoryObj<typeof NewProjectDialog>

export const Empty: Story = {
  args: {},
  parameters: {
    msw: {
      handlers: [userHandler, http.get("/api/github/orgs", () => HttpResponse.json([]))],
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
      ],
    },
  },
}
