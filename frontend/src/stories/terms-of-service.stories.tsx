import type { Meta, StoryObj, StoryContext } from "@storybook/react"
import type { JSX, ComponentType } from "react"

import ThemeWrapper from "./ThemeWrapper"
import { catchAllHandler } from "./mocks"
import TermsOfServiceComponent from "../pages/docs/terms-of-service"

type StoryArgs = {
  mode?: "light" | "dark"
}

const meta: Meta<typeof TermsOfServiceComponent> = {
  title: "stories/pages/docs/TermsOfService",
  component: TermsOfServiceComponent,
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
type Story = StoryObj<typeof TermsOfServiceComponent>

export const Light: Story = { args: { mode: "light" } }

export const Dark: Story = { args: { mode: "dark" } }
