import type { Meta, StoryObj, StoryContext } from "@storybook/react"
import { http, HttpResponse } from "msw"
import { type ComponentType } from "react"

import type { UserResponse } from "@/lib/apiTypes"

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
