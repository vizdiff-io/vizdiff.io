import type { CheckSuite } from "./CheckSuitePayload"

export interface CheckRunPayload {
  action: string
  requested_action?: {
    identifier: string
  }
  check_run: {
    check_suite: CheckSuite
    completed_at: string | null
    conclusion:
      | "waiting"
      | "pending"
      | "startup_failure"
      | "stale"
      | "success"
      | "failure"
      | "neutral"
      | "cancelled"
      | "skipped"
      | "timed_out"
      | "action_required"
      | null
    deployment: unknown
    details_url: string | null
    external_id: string | null
    head_sha: string
    html_url: string
    id: number
    name: string
    node_id: string
    output: {
      annotations_count: number
      annotations_url: string
      summary: string | null
      text: string | null
      title: string | null
    }
    pull_requests: Array<unknown>
    started_at: string
    status: "queued" | "in_progress" | "completed" | "pending"
    url: string
  }
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
