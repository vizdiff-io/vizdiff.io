import type { Meta, StoryObj, StoryContext } from "@storybook/react"
import { http, HttpResponse } from "msw"
import { type ComponentType } from "react"

import type { ProjectResponse } from "@/lib/apiTypes"

import ThemeWrapper from "./ThemeWrapper"
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
  },
  {
    id: 2,
    name: "Example Project",
    githubRepoUrl: "https://github.com/example/project",
    token: "def456ghi789",
    createdStampSec: oneMinuteAgo - 3600 * 24 * 7, // 1 week ago
  },
  {
    id: 3,
    name: "Test Project",
    githubRepoUrl: "https://github.com/test/project",
    token: "ghi789jkl012",
    createdStampSec: oneMinuteAgo - 3600, // 1 hour ago
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
      handlers: [http.get("/api/projects", () => HttpResponse.json(mockProjects))],
    },
  },
}

export default meta
type Story = StoryObj<typeof ProjectsComponent>

export const Projects: Story = {
  render: () => <ProjectsComponent />,
}
