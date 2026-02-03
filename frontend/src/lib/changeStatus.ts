import type { TestResultStatus } from "../../../shared/src/entity/types"

export function changeStatusMessage(changeStatus: TestResultStatus, diffRatio: number): string {
  switch (changeStatus) {
    case "new":
      return "New"
    case "unchanged":
      return "Unchanged"
    case "changed":
      return `Changed (${(diffRatio * 100).toFixed(2)}%)`
    case "failed":
      return "Failed"
    default:
      return String(changeStatus)
  }
}

export function changeStatusColor(changeStatus: TestResultStatus): string {
  switch (changeStatus) {
    case "unchanged":
      return "success.main"
    case "new":
    case "changed":
      return "warning.main"
    case "failed":
    default:
      return "error.main"
  }
}
