import type { TestResultStatus } from "../../../shared/src/entity/TestResult"

export function changeStatusMessage(changeStatus: TestResultStatus): string {
  switch (changeStatus) {
    case "new":
      return "New"
    case "unchanged":
      return "Unchanged"
    case "changed":
      return "Changed"
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
