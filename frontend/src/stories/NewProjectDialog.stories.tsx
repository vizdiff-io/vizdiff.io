import type { Meta, StoryContext, StoryObj } from "@storybook/nextjs"
import { http, HttpResponse } from "msw"
import type { JSX, ComponentType } from "react"
import { screen, userEvent } from "storybook/test"

import ThemeWrapper from "./ThemeWrapper"
import { avatar01 } from "./assets"
import { catchAllHandler, userHandler } from "./mocks"
import NewProjectDialog from "../components/NewProjectDialog"

type StoryArgs = {
  mode?: "light" | "dark"
}

// GitLab is the default (and, in Storybook, only) provider since NEXT_PUBLIC_GITHUB_ENABLED is not
// injected into the Storybook build, so GITHUB_ENABLED resolves to false. These mocks back the
// `/api/gitlab/groups` and `/api/gitlab/projects` endpoints the dialog calls in that mode.
const mockGitlabGroups = [
  {
    id: 1,
    login: "frontend-team",
    name: "Frontend Team",
    path: "frontend-team",
    full_path: "frontend-team",
    web_url: "https://gitlab.com/frontend-team",
    avatar_url: avatar01.src,
  },
  {
    id: 2,
    login: "design-system",
    name: "Design System",
    path: "design-system",
    full_path: "design-system",
    web_url: "https://gitlab.com/design-system",
    avatar_url: null,
  },
  {
    id: 3,
    login: "platform/web",
    name: "Web Platform",
    path: "web",
    full_path: "platform/web",
    web_url: "https://gitlab.com/platform/web",
    avatar_url: null,
  },
  {
    id: 4,
    login: "acme-corp/group-with-a-very-long-name-that-should-truncate",
    name: "Group With A Very Long Name",
    path: "group-with-a-very-long-name-that-should-truncate",
    full_path: "acme-corp/group-with-a-very-long-name-that-should-truncate",
    web_url: "https://gitlab.com/acme-corp/group-with-a-very-long-name-that-should-truncate",
    avatar_url: null,
  },
]

const baseNamespace = {
  id: 1,
  name: "Frontend Team",
  path: "frontend-team",
  kind: "group",
  full_path: "frontend-team",
}

const mockGitlabProjects = [
  {
    id: 101,
    name: "component-library",
    path: "component-library",
    path_with_namespace: "frontend-team/component-library",
    web_url: "https://gitlab.com/frontend-team/component-library",
    visibility: "private",
    namespace: baseNamespace,
  },
  {
    id: 102,
    name: "design-tokens",
    path: "design-tokens",
    path_with_namespace: "frontend-team/design-tokens",
    web_url: "https://gitlab.com/frontend-team/design-tokens",
    visibility: "public",
    namespace: baseNamespace,
  },
  {
    id: 103,
    name: "marketing-site",
    path: "marketing-site",
    path_with_namespace: "frontend-team/marketing-site",
    web_url: "https://gitlab.com/frontend-team/marketing-site",
    visibility: "internal",
    namespace: baseNamespace,
  },
  {
    id: 104,
    name: "project-with-a-very-long-name-that-should-truncate-nicely",
    path: "project-with-a-very-long-name-that-should-truncate-nicely",
    path_with_namespace: "frontend-team/project-with-a-very-long-name-that-should-truncate-nicely",
    web_url: "https://gitlab.com/frontend-team/long",
    visibility: "private",
    namespace: baseNamespace,
  },
]

const gitlabGroupsHandler = http.get("/api/gitlab/groups", () =>
  HttpResponse.json(mockGitlabGroups),
)
const gitlabProjectsHandler = http.get("/api/gitlab/projects", () =>
  HttpResponse.json(mockGitlabProjects),
)

const meta: Meta<typeof NewProjectDialog> = {
  title: "stories/components/NewProjectDialog",
  component: NewProjectDialog,
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
      handlers: [userHandler, gitlabGroupsHandler, gitlabProjectsHandler, catchAllHandler],
    },
  },
}

export default meta

type Story = StoryObj<typeof NewProjectDialog>

// Default view: the list of GitLab groups the service token can see.
export const Groups: Story = {
  args: { mode: "light" },
}

export const GroupsDark: Story = {
  args: { mode: "dark" },
}

// Clicking a group loads its projects into the right-hand pane.
export const Projects: Story = {
  args: { mode: "light" },
  play: async () => {
    // The dialog renders in a MUI portal, so query the whole document via `screen`.
    const group = await screen.findByText("frontend-team")
    await userEvent.click(group)
    // Projects load into the right-hand pane after the click; findBy* throws if they don't appear.
    await screen.findByText("component-library")
  },
}

export const Empty: Story = {
  args: { mode: "light" },
  parameters: {
    msw: {
      handlers: [
        userHandler,
        http.get("/api/gitlab/groups", () => HttpResponse.json([])),
        gitlabProjectsHandler,
        catchAllHandler,
      ],
    },
  },
}

export const EmptyDark: Story = {
  ...Empty,
  args: { mode: "dark" },
}

export const Loading: Story = {
  args: { mode: "light" },
  parameters: {
    msw: {
      handlers: [
        userHandler,
        http.get("/api/gitlab/groups", async () => {
          await new Promise((resolve) => setTimeout(resolve, 3000))
          return HttpResponse.json(mockGitlabGroups)
        }),
        gitlabProjectsHandler,
        catchAllHandler,
      ],
    },
  },
}

export const Mobile: Story = {
  args: { mode: "light" },
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile1" } },
}
