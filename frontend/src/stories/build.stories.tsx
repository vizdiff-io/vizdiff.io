import type { Meta, StoryObj, StoryContext } from "@storybook/react"
import { http, HttpResponse } from "msw"
import { type ComponentType } from "react"

import type { TestResponse } from "@/lib/apiTypes"

import ThemeWrapper from "./ThemeWrapper"
import BuildComponent from "../pages/build"

type StoryArgs = {
  mode?: "light" | "dark"
}

const mockData: TestResponse = {
  id: 123,
  projectId: 456,
  buildNumber: 42,
  commitSha: "abc123",
  branch: "main",
  uploadId: "upload-123",
  status: "completed",
  initiatedStampSec: Math.floor(Date.now() / 1000),
  testResults: [
    {
      id: 1,
      name: "Homepage Test",
      changeStatus: "changed",
      screenshotUrl: "https://placecats.com/800/600",
      ancestorScreenshotUrl: "https://placecats.com/800/600",
      diffMaskUrl: "https://placecats.com/800/600",
      createdStampSec: Math.floor(Date.now() / 1000),
    },
    {
      id: 2,
      name: "Dashboard Test",
      changeStatus: "unchanged",
      screenshotUrl: "https://placecats.com/800/600",
      ancestorScreenshotUrl: "https://placecats.com/800/600",
      createdStampSec: Math.floor(Date.now() / 1000),
    },
  ],
  parent: {
    id: 789,
    projectId: 456,
    buildNumber: 41,
    branch: "main",
    commitSha: "def456",
    uploadId: "upload-122",
    status: "completed",
    initiatedStampSec: Math.floor(Date.now() / 1000) - 3600,
  },
}

const meta: Meta<typeof BuildComponent> = {
  title: "stories/Build",
  component: BuildComponent,
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
    nextjs: {
      router: {
        query: { id: "123" },
      },
    },
    msw: {
      handlers: [http.get("/api/tests/:id", () => HttpResponse.json(mockData))],
    },
  },
}

export default meta
type Story = StoryObj<typeof BuildComponent>

export const Build: Story = {
  render: () => <BuildComponent />,
}
