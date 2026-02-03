/**
 * Supported Version Control System providers
 */
export type VCSProvider = "github" | "gitlab"

/**
 * Status values for screenshot test results
 */
export type TestResultStatus = "new" | "unchanged" | "changed" | "failed"

/**
 * Status values for screenshot tests (builds)
 */
export type ScreenshotTestStatus =
  | "pending"
  | "running"
  | "no_changes"
  | "unapproved"
  | "approved"
  | "denied"
  | "failed"
