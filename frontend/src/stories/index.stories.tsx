import type { Meta, StoryObj, StoryContext } from "@storybook/react"
import { type ComponentType } from "react"

import ThemeWrapper from "./ThemeWrapper"
import HomeComponent from "../pages/index"

type StoryArgs = {
  mode?: "light" | "dark"
}

const meta: Meta<typeof HomeComponent> = {
  component: HomeComponent,
  argTypes: {
    mode: {
      control: "radio",
      options: ["light", "dark"],
      defaultValue: "light",
    },
  },
  decorators: [
    (Story: ComponentType, context: StoryContext<StoryArgs>): JSX.Element => (
      <ThemeWrapper mode={context.args.mode ?? "light"}>
        <Story />
      </ThemeWrapper>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof HomeComponent>

export const Home: Story = {
  render: () => <HomeComponent />,
}
