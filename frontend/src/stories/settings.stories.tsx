import type { Meta, StoryObj, StoryContext } from "@storybook/react"
import { http, HttpResponse } from "msw"
import { type ComponentType } from "react"

import type { ProjectResponse, UserResponse } from "@/lib/apiTypes"

import ThemeWrapper from "./ThemeWrapper"
import { catchAllHandler, mockUser, userHandler } from "./mocks"
import SettingsComponent from "../pages/settings"

type StoryArgs = {
  mode?: "light" | "dark"
}

const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60
const oneDayFromNow = Math.floor(Date.now() / 1000) + 24 * 60 * 60
const mockUserWithTrial: UserResponse = {
  ...mockUser,
  subscription: null,
  trialEndStampSec: oneDayFromNow,
}
const mockUserWithExpiredTrial: UserResponse = {
  ...mockUser,
  subscription: null,
  trialEndStampSec: oneMinuteAgo,
}
const mockUserWithExpiredTrialNoProjects: UserResponse = {
  ...mockUser,
  subscription: null,
  trialEndStampSec: oneMinuteAgo,
  ownedProjectCount: 0,
}

const mockProjects: ProjectResponse[] = [
  {
    id: 1,
    name: "vizdiff.io",
    githubRepoUrl: "https://github.com/mvi-llc/vizdiff.io",
    token: "abc123def456",
    ownerId: 123,
    hasActiveSubscription: true,
    createdStampSec: oneMinuteAgo - 3600 * 24 * 30, // 1 month ago
    lastBuildStampSec: oneMinuteAgo - 3600, // 1 hour ago
    builds: 42,
    tests: 156,
  },
  {
    id: 2,
    name: "Expired Trial Project",
    githubRepoUrl: "https://github.com/example/example-project",
    token: "def456ghi789",
    ownerId: 123,
    hasActiveSubscription: false,
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
    ownerId: 456,
    hasActiveSubscription: true,
    createdStampSec: oneMinuteAgo - 3600, // 1 hour ago
    lastBuildStampSec: oneMinuteAgo, // just now
    builds: 3,
    tests: 12,
  },
  {
    id: 4,
    name: "Expired Other Project",
    githubRepoUrl: "https://github.com/example/example-project",
    token: "jkl012mno345",
    ownerId: 456,
    hasActiveSubscription: false,
    createdStampSec: oneMinuteAgo - 3600 * 24 * 7, // 1 week ago
    lastBuildStampSec: oneMinuteAgo - 3600 * 24, // 1 day ago
    builds: 9001,
    tests: 42,
  },
]

const meta: Meta<typeof SettingsComponent> = {
  title: "stories/pages/Settings",
  component: SettingsComponent,
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
        http.delete("/api/users/me", () =>
          HttpResponse.json(
            {
              error:
                "Cannot delete an account with an active subscription. If you want to delete " +
                "before your subscription has ended, please email contact@vizdiff.io",
            },
            { status: 400 },
          ),
        ),
        catchAllHandler,
      ],
    },
  },
}

export default meta
type Story = StoryObj<typeof SettingsComponent>

export const Light: Story = {
  args: {
    mode: "light",
  },
}

export const Dark: Story = {
  args: {
    mode: "dark",
  },
}

export const TrialPeriod: Story = {
  args: {
    mode: "light",
  },
  parameters: {
    msw: {
      handlers: [
        http.get("/api/users/me", () => HttpResponse.json(mockUserWithTrial)),
        http.delete("/api/users/me", () =>
          HttpResponse.json({ success: true, message: "Account deleted successfully" }),
        ),
        catchAllHandler,
      ],
    },
  },
}

export const ExpiredTrialPeriod: Story = {
  args: {
    mode: "light",
  },
  parameters: {
    msw: {
      handlers: [
        http.get("/api/users/me", () => HttpResponse.json(mockUserWithExpiredTrial)),
        http.delete("/api/users/me", () =>
          HttpResponse.json({ success: true, message: "Account deleted successfully" }),
        ),
        catchAllHandler,
      ],
    },
  },
}

export const ExpiredNoProjects: Story = {
  args: {
    mode: "light",
  },
  parameters: {
    msw: {
      handlers: [
        http.get("/api/users/me", () => HttpResponse.json(mockUserWithExpiredTrialNoProjects)),
        http.delete("/api/users/me", () =>
          HttpResponse.json({ success: true, message: "Account deleted successfully" }),
        ),
        catchAllHandler,
      ],
    },
  },
}
