export type Project = {
  id: number
  name: string
  githubRepoUrl: string
  token: string
  createdAt: Date
  updatedAt: Date
}

export type BuildInfo = {
  buildNumber: number
  initiatedStampSec: string
  buildTimeSec: number
  components: number
  stories: number
  browsers: string[]
  uiReviews: string
  commit: string
  repository: string
  branch: string
  tests: {
    visual: number
    changes: number
    ancestor: boolean
    buildNumber: number
    accepted: number
    denied: number
    unreviewed: number
  }
}
