export interface CheckSuite {
  id: number
  head_branch: string
  head_sha: string
  status: string
  conclusion: string | null
  pull_requests: Array<{
    number: number
    head: {
      ref: string
      sha: string
      repo: {
        id: number
        name: string
      }
    }
    base: {
      ref: string
      sha: string
      repo: {
        id: number
        name: string
      }
    }
  }>
}

export interface CheckSuitePayload {
  action: string
  check_suite: CheckSuite
  repository: {
    id: number
    name: string
    full_name: string
    owner: {
      login: string
      id: number
    }
  }
  organization?: {
    login: string
    id: number
  }
  sender: {
    login: string
    id: number
  }
  installation: {
    id: number
    node_id: string
  }
}
