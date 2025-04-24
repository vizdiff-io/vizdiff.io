import type { Meta, StoryObj, StoryContext } from "@storybook/react"
import type { JSX, ComponentType } from "react"

import ThemeWrapper from "./ThemeWrapper"
import { catchAllHandler, userHandler } from "./mocks"
import PricingComponent from "../pages/pricing"

type StoryArgs = {
  mode?: "light" | "dark"
  isAuthenticated?: boolean
}

const meta: Meta<typeof PricingComponent> = {
  title: "stories/pages/Pricing",
  component: PricingComponent,
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
  parameters: {
    msw: {
      handlers: [userHandler, catchAllHandler],
    },
  },
}

export default meta
type Story = StoryObj<typeof PricingComponent>

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
