export type Project = {
  id: number
  name: string
  githubRepoUrl: string
  token: string
  createdStampSec: number
}

export type ScreenshotTest = {
  id: number
  projectId: number
  buildNumber: number
  commitSha: string
  branch: string
  baseCommitSha?: string
  baseBranch?: string
  uploadId: string
  status: string
  components: number
  stories: number
  changes?: number
  tag?: string
  initiatedStampSec: number
  buildTimeSec?: number
}

export type TestResult = {
  id: number
  name: string
  screenshotUrl: string
  ancestorScreenshotUrl?: string
  diffMaskUrl?: string
  hasDiff: boolean
  createdStampSec: number
}

export type TestResponse = ScreenshotTest & {
  parent?: ScreenshotTest
  testResults: TestResult[]
}
