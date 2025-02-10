import type { Theme } from "@mui/material"

import type { TestResponse } from "./apiTypes"

export function getStatusColor(theme: Theme, status: TestResponse["status"]): string {
  switch (status) {
    case "pending":
      return theme.palette.primary.main
    case "running":
      return theme.palette.secondary.main
    case "no_changes":
    case "approved":
      return theme.palette.success.main
    case "unapproved":
      return theme.palette.warning.main
    case "denied":
    case "failed":
      return theme.palette.error.main
  }
}
