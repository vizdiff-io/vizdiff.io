export type Project = {
  id: number
  name: string
  githubRepoUrl: string
  token: string
  createdStampSec: number
}

export type ScreenshotTestResponse = {
  id: number
  projectId: number
  buildNumber: number
  commitSha: string
  branch: string
  baseCommitSha?: string
  baseBranch?: string
  uploadId: string
  status: string
  tag?: string
  initiatedStampSec: number
  buildDurationSec?: number
}

export type ScreenshotTestSummaryResponse = ScreenshotTestResponse & {
  components?: number
  stories?: number
  changes?: number
}

export type TestResultResponse = {
  id: number
  name: string
  changeStatus: "new" | "unchanged" | "changed"
  screenshotUrl: string
  ancestorScreenshotUrl?: string
  diffMaskUrl?: string
  createdStampSec: number
}

export type TestResponse = ScreenshotTestResponse & {
  parent?: ScreenshotTestResponse
  testResults: TestResultResponse[]
}
