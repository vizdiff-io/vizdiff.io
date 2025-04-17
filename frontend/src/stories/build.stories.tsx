import type { Meta, StoryObj, StoryContext } from "@storybook/react"
import { http, HttpResponse } from "msw"
import { type ComponentType } from "react"

import type { TestResponse } from "@/lib/apiTypes"

import ThemeWrapper from "./ThemeWrapper"
import {
  screenshot01Base,
  screenshot01Diff,
  screenshot01New,
  screenshot02New,
  screenshot03New,
} from "./assets"
import { catchAllHandler, userHandler } from "./mocks"
import BuildComponent from "../pages/build"

type StoryArgs = {
  mode?: "light" | "dark"
}

const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60
const mockBuildData: TestResponse = {
  id: 123,
  projectId: 456,
  projectName: "Cat Photos",
  buildNumber: 42,
  githubRepoUrl: "https://github.com/cats/cat-photos",
  commitSha: "abc123433dcad967ac73e8219f3c9fa5d2b49a70",
  branch: "main",
  prNumber: 123,
  uploadId: "upload-123",
  status: "approved",
  initiatedStampSec: oneMinuteAgo,
  testResults: [
    {
      id: 1,
      name: "pages/Homepage/Homepage Test",
      changeStatus: "changed",
      screenshotUrl: screenshot01New.src,
      ancestorScreenshotUrl: screenshot01Base.src,
      diffMaskUrl: screenshot01Diff.src,
      diffRatio: 0.0932,
      createdStampSec: oneMinuteAgo,
    },
    {
      id: 2,
      name: "components/Excessively Long Path/With Many Words/And Many More Words/Dashboard/Dashboard Test",
      changeStatus: "unchanged",
      screenshotUrl: screenshot02New.src,
      ancestorScreenshotUrl: screenshot02New.src,
      createdStampSec: oneMinuteAgo,
    },
    {
      id: 3,
      name: "pages/Login/Login Test",
      changeStatus: "new",
      screenshotUrl: screenshot03New.src,
      createdStampSec: oneMinuteAgo,
    },
  ],
  parent: {
    id: 789,
    projectId: 456,
    projectName: "Cat Photos",
    buildNumber: 41,
    githubRepoUrl: "https://github.com/cats/cat-photos",
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
      return (
        <ThemeWrapper mode={context.args.mode ?? "light"} isAuthenticated={true}>
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
      handlers: [
        userHandler,
        http.get("/api/tests/:id", () => HttpResponse.json(mockBuildData)),
        catchAllHandler,
      ],
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

export const Pending: Story = {
  args: {
    mode: "light",
  },
  parameters: {
    msw: {
      handlers: [
        userHandler,
        http.get("/api/tests/:id", () =>
          HttpResponse.json({ ...mockBuildData, status: "pending", testResults: [] }),
        ),
        catchAllHandler,
      ],
    },
  },
}

export const Running: Story = {
  args: {
    mode: "light",
  },
  parameters: {
    msw: {
      handlers: [
        userHandler,
        http.get("/api/tests/:id", () =>
          HttpResponse.json({
            ...mockBuildData,
            status: "running",
            testResults: mockBuildData.testResults.slice(0, 1),
          }),
        ),
        catchAllHandler,
      ],
    },
  },
}

export const NoTests: Story = {
  args: {
    mode: "light",
  },
  parameters: {
    msw: {
      handlers: [
        userHandler,
        http.get("/api/tests/:id", () =>
          HttpResponse.json({ ...mockBuildData, status: "unapproved", testResults: [] }),
        ),
        catchAllHandler,
      ],
    },
  },
}

export const NoChanges: Story = {
  args: {
    mode: "light",
  },
  parameters: {
    msw: {
      handlers: [
        userHandler,
        http.get("/api/tests/:id", () =>
          HttpResponse.json({ ...mockBuildData, status: "no_changes" }),
        ),
        catchAllHandler,
      ],
    },
  },
}

export const Unapproved: Story = {
  args: {
    mode: "light",
  },
  parameters: {
    msw: {
      handlers: [
        userHandler,
        http.get("/api/tests/:id", () =>
          HttpResponse.json({ ...mockBuildData, status: "unapproved" }),
        ),
        catchAllHandler,
      ],
    },
  },
}

export const Denied: Story = {
  args: {
    mode: "light",
  },
  parameters: {
    msw: {
      handlers: [
        userHandler,
        http.get("/api/tests/:id", () => HttpResponse.json({ ...mockBuildData, status: "denied" })),
        catchAllHandler,
      ],
    },
  },
}

export const Failed: Story = {
  args: {
    mode: "light",
  },
  parameters: {
    msw: {
      handlers: [
        userHandler,
        http.get("/api/tests/:id", () => HttpResponse.json({ ...mockBuildData, status: "failed" })),
        catchAllHandler,
      ],
    },
  },
}
