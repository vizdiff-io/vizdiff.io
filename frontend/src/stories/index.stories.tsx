import type { Meta, StoryObj } from "@storybook/react"

import HomeComponent from "../pages/index"

const meta: Meta<typeof HomeComponent> = {
  component: HomeComponent,
}

export default meta
type Story = StoryObj<typeof HomeComponent>

export const Home: Story = {
  render: () => <HomeComponent />,
}
