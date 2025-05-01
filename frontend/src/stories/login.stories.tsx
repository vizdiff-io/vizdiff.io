import type { Meta, StoryObj, StoryContext } from "@storybook/react"
import { HttpResponse, http } from "msw"
import type { JSX, ComponentType } from "react"

import ThemeWrapper from "./ThemeWrapper"
import { catchAllHandler } from "./mocks"
import LoginComponent from "../pages/login"

type StoryArgs = {
  mode?: "light" | "dark"
}

const meta: Meta<typeof LoginComponent> = {
  title: "stories/pages/Login",
  component: LoginComponent,
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
  parameters: {
    nextjs: {
      router: {
        query: { redirect: "https://vizdiff.io/projects" },
      },
    },
    msw: {
      handlers: [
        http.get("/api/users/me", () => new HttpResponse(null, { status: 401 })),
        catchAllHandler,
      ],
    },
  },
}

export default meta
type Story = StoryObj<typeof LoginComponent>

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

export const Mobile: Story = {
  args: {
    mode: "light",
  },
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile1" } },
}
