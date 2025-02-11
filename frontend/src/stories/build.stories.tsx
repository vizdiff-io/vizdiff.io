import type { Meta, StoryObj, StoryContext } from "@storybook/react"
import { http, HttpResponse } from "msw"
import { type ComponentType } from "react"

import type { TestResponse } from "@/lib/apiTypes"

import ThemeWrapper from "./ThemeWrapper"
import { userHandler } from "./mocks"
import BuildComponent from "../pages/build"

type StoryArgs = {
  mode?: "light" | "dark"
}

const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60
const mockBuildData: TestResponse = {
  id: 123,
  projectId: 456,
  buildNumber: 42,
  commitSha: "abc123",
  branch: "main",
  uploadId: "upload-123",
  status: "approved",
  initiatedStampSec: oneMinuteAgo,
  testResults: [
    {
      id: 1,
      name: "Homepage Test",
      changeStatus: "changed",
      screenshotUrl: "https://placecats.com/millie/800/600",
      ancestorScreenshotUrl: "https://placecats.com/neo/800/600",
      diffMaskUrl: "https://placecats.com/millie_neo/800/600",
      createdStampSec: oneMinuteAgo,
    },
    {
      id: 2,
      name: "Dashboard Test",
      changeStatus: "unchanged",
      screenshotUrl: "https://placecats.com/neo_banana/800/600",
      ancestorScreenshotUrl: "https://placecats.com/bella/800/600",
      createdStampSec: oneMinuteAgo,
    },
    {
      id: 3,
      name: "Login Test",
      changeStatus: "new",
      screenshotUrl: "https://placecats.com/poppy/800/600",
      createdStampSec: oneMinuteAgo,
    },
  ],
  parent: {
    id: 789,
    projectId: 456,
    buildNumber: 41,
    branch: "main",
    commitSha: "def456",
    uploadId: "upload-122",
    status: "no_changes",
    initiatedStampSec: oneMinuteAgo - 3600,
  },
}

const meta: Meta<typeof BuildComponent> = {
  title: "stories/pages/Build",
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
      handlers: [userHandler, http.get("/api/tests/:id", () => HttpResponse.json(mockBuildData))],
    },
  },
}

export default meta
type Story = StoryObj<typeof BuildComponent>

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
