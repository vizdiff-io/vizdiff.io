export type TestResultStatus = "new" | "unchanged" | "changed" | "failed"

export type GithubUser = {
  login: string
  id: number
  node_id: string
  avatar_url: string
  email: string | null
}

export type GitHubInstallationResponse = {
  id: number
  installationId: number
  accountId: string
  accountName: string
  accountType: string
  isCreator: boolean
  createdStampSec: number
}

export type UserResponse = {
  id: number
  githubId: string
  email: string | null
  githubUsername: string
  githubProfile: GithubUser
  createdStampSec: number
  updatedStampSec: number
  githubInstallations: GitHubInstallationResponse[]
  subscription: {
    plan: string
    interval: string
  } | null
}

export type ProjectResponse = {
  id: number
  name: string
  githubRepoUrl: string
  token: string
  createdStampSec: number
  lastBuildStampSec: number
  builds: number
  tests: number
}

export type ScreenshotTestResponse = {
  id: number
  projectId: number
  projectName: string
  buildNumber: number
  githubRepoUrl: string
  commitSha: string
  branch: string
  baseCommitSha?: string
  baseBranch?: string
  prNumber?: number
  uploadId: string
  status: "pending" | "running" | "no_changes" | "unapproved" | "approved" | "denied" | "failed"
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
  changeStatus: TestResultStatus
  screenshotUrl: string
  ancestorScreenshotUrl?: string
  diffMaskUrl?: string
  diffRatio?: number
  createdStampSec: number
}

export type TestResponse = ScreenshotTestResponse & {
  parent?: ScreenshotTestResponse
  testResults: TestResultResponse[]
}
