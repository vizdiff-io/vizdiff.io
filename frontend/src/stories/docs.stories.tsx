import type { Meta, StoryObj, StoryContext } from "@storybook/react"
import type { JSX, ComponentType } from "react"

import ThemeWrapper from "./ThemeWrapper"
import { catchAllHandler } from "./mocks"
import GettingStartedComponent from "../pages/docs"

type StoryArgs = {
  mode?: "light" | "dark"
}

const meta: Meta<typeof GettingStartedComponent> = {
  title: "stories/pages/docs/GitLab",
  component: GettingStartedComponent,
  argTypes: {
    mode: {
      control: "radio",
      options: ["light", "dark"],
      defaultValue: "light",
    },
  },
  decorators: [
    (Story: ComponentType, context: StoryContext<StoryArgs>): JSX.Element => {
      return (
        <ThemeWrapper mode={context.args.mode ?? "light"} isAuthenticated={false}>
          <Story />
        </ThemeWrapper>
      )
    },
  ],
  parameters: { msw: { handlers: [catchAllHandler] } },
}

export default meta
type Story = StoryObj<typeof GettingStartedComponent>

export const Light: Story = { args: { mode: "light" } }

export const Dark: Story = { args: { mode: "dark" } }

export const Mobile: Story = {
  args: {
    mode: "light",
  },
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile1" } },
}
