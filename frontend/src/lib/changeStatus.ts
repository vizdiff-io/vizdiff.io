export function changeStatusMessage(changeStatus: string) {
  switch (changeStatus) {
    case "new":
      return "New"
    case "unchanged":
      return "Unchanged"
    case "changed":
      return "Changed"
    default:
      return changeStatus
  }
}

export function changeStatusColor(changeStatus: string) {
  switch (changeStatus) {
    case "unchanged":
      return "success.main"
    case "new":
    case "changed":
    default:
      return "error.main"
  }
}
