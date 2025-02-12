import type { Meta, StoryObj, StoryContext } from "@storybook/react"
import { http, HttpResponse } from "msw"
import { type ComponentType } from "react"

import type { ProjectResponse, ScreenshotTestResponse } from "@/lib/apiTypes"

import ThemeWrapper from "./ThemeWrapper"
import { userHandler } from "./mocks"
import ProjectsComponent from "../pages/projects"

type StoryArgs = {
  mode?: "light" | "dark"
}

const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60
const mockProjects: ProjectResponse[] = [
  {
    id: 1,
    name: "vizdiff.io",
    githubRepoUrl: "https://github.com/MetaverseIndustries/vizdiff.io",
    token: "abc123def456",
    createdStampSec: oneMinuteAgo - 3600 * 24 * 30, // 1 month ago
    lastBuildStampSec: oneMinuteAgo - 3600, // 1 hour ago
    builds: 42,
    tests: 156,
  },
  {
    id: 2,
    name: "example-project",
    githubRepoUrl: "https://github.com/example/example-project",
    token: "def456ghi789",
    createdStampSec: oneMinuteAgo - 3600 * 24 * 7, // 1 week ago
    lastBuildStampSec: oneMinuteAgo - 3600 * 24, // 1 day ago
    builds: 1,
    tests: 1,
  },
  {
    id: 3,
    name: "MyAwesomeProject",
    githubRepoUrl: "https://github.com/test/MyAwesomeProject",
    token: "ghi789jkl012",
    createdStampSec: oneMinuteAgo - 3600, // 1 hour ago
    lastBuildStampSec: oneMinuteAgo, // just now
    builds: 3,
    tests: 12,
  },
]
const mockActivity: ScreenshotTestResponse[] = [
  {
    id: 1,
    projectId: 1,
    buildNumber: 6,
    commitSha: "abc123def456",
    branch: "main",
    baseCommitSha: "abc123def456",
    baseBranch: "main",
    uploadId: "abc123def456",
    status: "pending",
    tag: "v1.0.0",
    initiatedStampSec: oneMinuteAgo - 3600, // 1 hour ago
    buildDurationSec: 100,
  },
  {
    id: 2,
    projectId: 2,
    buildNumber: 5,
    commitSha: "abc123def456",
    branch: "main",
    uploadId: "abc123def456",
    status: "running",
    initiatedStampSec: oneMinuteAgo - 3600 * 24, // 1 day ago
    buildDurationSec: 100,
  },
  {
    id: 3,
    projectId: 3,
    buildNumber: 4,
    commitSha: "abc123def456",
    branch: "main",
    uploadId: "abc123def456",
    status: "no_changes",
    initiatedStampSec: oneMinuteAgo - 3600 * 24 * 30, // 1 month ago
    buildDurationSec: 100,
  },
  {
    id: 4,
    projectId: 4,
    buildNumber: 3,
    commitSha: "abc123def456",
    branch: "main",
    uploadId: "abc123def456",
    status: "failed",
    initiatedStampSec: oneMinuteAgo - 3600 * 24 * 30, // 1 month ago
    buildDurationSec: 100,
  },
  {
    id: 5,
    projectId: 5,
    buildNumber: 2,
    commitSha: "abc123def456",
    branch: "main",
    uploadId: "abc123def456",
    status: "approved",
    initiatedStampSec: oneMinuteAgo - 3600 * 24 * 30, // 1 month ago
    buildDurationSec: 100,
  },
  {
    id: 6,
    projectId: 6,
    buildNumber: 1,
    commitSha: "abc123def456",
    branch: "main",
    uploadId: "abc123def456",
    status: "unapproved",
    initiatedStampSec: oneMinuteAgo - 3600 * 24 * 30, // 1 month ago
    buildDurationSec: 100,
  },
]

const meta: Meta<typeof ProjectsComponent> = {
  title: "stories/pages/Projects",
  component: ProjectsComponent,
  argTypes: {
    mode: {
      control: "radio",
      options: ["light", "dark"],
      defaultValue: "light",
    },
  },
  decorators: [
    (Story: ComponentType, context: StoryContext<StoryArgs>): JSX.Element => {
      // Set authentication cookie for Storybook
      document.cookie = "authenticated=true; path=/"
      return (
        <ThemeWrapper mode={context.args.mode ?? "light"}>
          <Story />
        </ThemeWrapper>
      )
    },
  ],
  parameters: {
    msw: {
      handlers: [
        userHandler,
        http.get("/api/projects", () => HttpResponse.json(mockProjects)),
        http.get("/api/activity", () => HttpResponse.json(mockActivity)),
      ],
    },
  },
}

export default meta
type Story = StoryObj<typeof ProjectsComponent>

export const Light: Story = { args: { mode: "light" } }

export const Dark: Story = { args: { mode: "dark" } }

export const EmptyProjects: Story = {
  args: { mode: "light" },
  parameters: {
    msw: {
      handlers: [userHandler, http.get("/api/projects", () => HttpResponse.json([]))],
    },
  },
  render: () => <ProjectsComponent />,
}
