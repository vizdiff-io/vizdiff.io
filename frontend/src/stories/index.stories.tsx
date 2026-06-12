import type { Meta, StoryObj, StoryContext } from "@storybook/nextjs"
import type { JSX, ComponentType } from "react"

import ThemeWrapper from "./ThemeWrapper"
import { catchAllHandler, userHandler } from "./mocks"
import HomeComponent from "../pages/index"

type StoryArgs = {
  mode?: "light" | "dark"
  isAuthenticated?: boolean
}

const meta: Meta<typeof HomeComponent> = {
  title: "stories/pages/Home",
  component: HomeComponent,
  argTypes: {
    mode: {
      control: "radio",
      options: ["light", "dark"],
      defaultValue: "light",
    },
    isAuthenticated: {
      control: "boolean",
      defaultValue: false,
    },
  },
  decorators: [
    (Story: ComponentType, context: StoryContext<StoryArgs>): JSX.Element => (
      <ThemeWrapper
        mode={context.args.mode ?? "light"}
        isAuthenticated={context.args.isAuthenticated}
      >
        <Story />
      </ThemeWrapper>
    ),
  ],
  parameters: { msw: { handlers: [userHandler, catchAllHandler] } },
}

export default meta
type Story = StoryObj<typeof HomeComponent>

export const Light: Story = {
  args: {
    mode: "light",
    isAuthenticated: false,
  },
  parameters: { msw: { handlers: [catchAllHandler] } },
}

export const Dark: Story = {
  args: {
    mode: "dark",
    isAuthenticated: false,
  },
  parameters: { msw: { handlers: [catchAllHandler] } },
}

export const Authenticated: Story = {
  args: {
    mode: "light",
    isAuthenticated: true,
  },
  parameters: { msw: { handlers: [catchAllHandler] } },
}

export const Mobile: Story = {
  args: {
    mode: "light",
    isAuthenticated: false,
  },
  parameters: { layout: "fullscreen", msw: { handlers: [catchAllHandler] } },
  globals: { viewport: { value: "mobile1" } },
}

export const MobileAuthenticated: Story = {
  args: {
    mode: "light",
    isAuthenticated: true,
  },
  parameters: { layout: "fullscreen", msw: { handlers: [catchAllHandler] } },
  globals: { viewport: { value: "mobile1" } },
}
