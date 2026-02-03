export type TestResultStatus = "new" | "unchanged" | "changed" | "failed"

export type VCSProvider = "github" | "gitlab"

export type GithubUser = {
  login: string
  id: number
  name: string | null
  node_id: string
  avatar_url: string
  email: string | null
}

export type GitlabUser = {
  id: number
  username: string
  name: string
  avatar_url: string
  web_url: string
  email?: string
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

export type GitLabGroupResponse = {
  id: number
  gitlabGroupId: number
  groupPath: string
  groupName: string
  fullPath: string
  gitlabHost: string
  avatarUrl: string | null
  webUrl: string
  createdStampSec: number
}

export type UserResponse = {
  id: number
  email: string | null
  ownedProjectCount: number
  trialEndStampSec: number
  createdStampSec: number
  updatedStampSec: number
  subscription: {
    plan: string
    interval: string
  } | null
  // GitHub fields (nullable for GitLab-only users)
  githubId: string | null
  githubUsername: string | null
  githubProfile: GithubUser | null
  githubInstallations: GitHubInstallationResponse[]
  // GitLab fields (nullable for GitHub-only users)
  gitlabId: string | null
  gitlabUsername: string | null
  gitlabProfile: GitlabUser | null
  gitlabHost: string | null
  gitlabGroups: GitLabGroupResponse[]
}

export type ProjectResponse = {
  id: number
  name: string
  vcsProvider: VCSProvider
  repoUrl: string
  token: string
  ownerId: number
  hasActiveSubscription: boolean
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
  vcsProvider: VCSProvider
  repoUrl: string
  commitSha: string
  branch: string
  baseCommitSha?: string
  baseBranch?: string
  prNumber?: number
  mergeRequestId?: number
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

export type BillingPeriodUsageResponse = {
  totalUsage: number
  subscriptionIncludedUsage: number
  periodStartSec: number
  periodEndSec: number
  status: "draft" | "open" | "paid" | "uncollectible" | "void" | "trial"
}
