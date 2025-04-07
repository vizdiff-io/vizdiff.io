import type { ScreenshotTest } from "./entity/ScreenshotTest"
import type { TestResult } from "./entity/TestResult"

const EMPTY_IMAGE_URL = "https://upload.wikimedia.org/wikipedia/commons/5/59/Empty.png"
const FAILED_IMAGE_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Red_X.svg/480px-Red_X.svg.png"

// Generates a GitHub Flavored Markdown summary for a screenshot test build
export function createSummaryForBuild(build: ScreenshotTest): string {
  if (build.baseCommitSha) {
    let summary =
      `Rendering storybook components for [build #${build.buildNumber}](https://vizdiff.io/build?id=${build.id}), ` +
      `comparing commit [${build.commitSha}](${build.project.githubRepoUrl}/commit/${build.commitSha}) ` +
      `(branch [${build.branch}](${build.project.githubRepoUrl}/tree/${build.branch})) against ` +
      `[${build.baseCommitSha}](${build.project.githubRepoUrl}/commit/${build.baseCommitSha})`
    summary += build.baseBranch
      ? ` (branch [${build.baseBranch}](${build.project.githubRepoUrl}/tree/${build.baseBranch}))`
      : "."
    return summary
  }

  return (
    `Rendering storybook components for [build #${build.buildNumber}](https://vizdiff.io/build?id=${build.id}), ` +
    `commit [${build.commitSha}](${build.project.githubRepoUrl}/commit/${build.commitSha}) ` +
    `(branch [${build.branch}](${build.project.githubRepoUrl}/tree/${build.branch})).`
  )
}

export function createSummaryForFailedBuild(build: ScreenshotTest, error: unknown): string {
  const errString = error instanceof Error ? error.message : String(error)

  if (build.baseCommitSha) {
    let summary =
      `⚠️ Failed to render storybook components for [build #${build.buildNumber}](https://vizdiff.io/build?id=${build.id}), ` +
      `comparing commit [${build.commitSha}](${build.project.githubRepoUrl}/commit/${build.commitSha}) ` +
      `(branch [${build.branch}](${build.project.githubRepoUrl}/tree/${build.branch})) against ` +
      `[${build.baseCommitSha}](${build.project.githubRepoUrl}/commit/${build.baseCommitSha})`
    summary += build.baseBranch
      ? ` (branch [${build.baseBranch}](${build.project.githubRepoUrl}/tree/${build.baseBranch}))`
      : "."
    summary += `\n---\nUpload ID: ${build.uploadId}\nReason: ${errString}`
    return summary
  }

  let summary =
    `⚠️ Failed to render storybook components for [build #${build.buildNumber}](https://vizdiff.io/build?id=${build.id}), ` +
    `commit [${build.commitSha}](${build.project.githubRepoUrl}/commit/${build.commitSha}) ` +
    `(branch [${build.branch}](${build.project.githubRepoUrl}/tree/${build.branch})).`
  summary += `\n---\nUpload ID: ${build.uploadId}\nReason: ${errString}`
  return summary
}

export function createMarkdownForBuildResult(
  build: ScreenshotTest,
  testResults: TestResult[],
): { title: string; summary: string; text: string } {
  const testCount = testResults.length
  const changeCount = getChangeCount(testResults)
  const failedCount = testResults.filter((r) => r.changeStatus === "failed").length

  // Create the title that shows up inline in the Pull Request list of status checks
  const title =
    changeCount > 0
      ? `${changeCount} change${changeCount === 1 ? "" : "s"} to review.`
      : "No visual changes detected."

  // Create the summary that appears at the top of this status check's details page
  const statusText = getStatusHeader(build)
  let summary =
    `|**${testCount}**|**${changeCount}**|**${statusText}**|\n` +
    `|-|-|:-:|\n` +
    `|Tests|Changes|Status|\n\n` +
    `Review [build #${build.buildNumber}](https://vizdiff.io/build?id=${build.id}) on vizdiff.io for a detailed comparison.`
  if (failedCount > 0) {
    summary += `\n---\n ⚠️ ${failedCount} test${failedCount === 1 ? "" : "s"} failed to render.`
  }

  // Sort test results to show failed/changed/new/unchanged in that order
  const sortedTestResults = getSortedTestResults(testResults)

  // Create the detailed text that appears below the summary on this status check's details page
  let text = "### Visual Tests\n"
  for (const testResult of sortedTestResults) {
    text += `> **${testResult.name}**\n`
    // Before image
    if (testResult.changeStatus === "new") {
      text += `> <img src="${EMPTY_IMAGE_URL}" alt="No baseline image" width="250" /> &nbsp;&nbsp;&nbsp; `
    } else {
      text +=
        `> <a href="${testResult.baselineImageUrl}">` +
        `<img src="${testResult.baselineImageUrl}" alt="${testResult.screenshotTest.baseCommitSha ?? "Baseline"}" width="250" />` +
        `</a> &nbsp;&nbsp;&nbsp; `
    }
    // After image
    if (testResult.changeStatus === "failed") {
      text += `<img src="${FAILED_IMAGE_URL}" alt="Failed" width="250" />\n`
    } else {
      text +=
        `<a href="${testResult.newImageUrl}">` +
        `<img src="${testResult.newImageUrl}" alt="${testResult.screenshotTest.commitSha}" width="250" />` +
        `</a>\n`
    }
    // Status line
    text += `> ${getChangeStatusText(testResult)}\n\n`
  }

  return { title, summary, text }
}

export function createMarkdownForBuildApproval(
  build: ScreenshotTest,
  testResults: TestResult[],
  username: string,
): { title: string; summary: string; text?: string } {
  if (build.status !== "approved" && build.status !== "denied") {
    throw new Error(
      `Cannot generate approval markdown for test ${build.id} status: ${build.status}`,
    )
  }

  const approved = build.status === "approved"
  const changeCount = getChangeCount(testResults)
  const title = `${changeCount} change${changeCount === 1 ? "" : "s"} ${build.status} by ${username}.`

  let { summary, text } = createMarkdownForBuildResult(build, testResults)
  summary += `\n---\n ${approved ? "✅ Approved" : "❌ Rejected"} by ${username}`

  return { title, summary, text }
}

function getChangeCount(testResults: TestResult[]): number {
  return testResults.filter((r) => r.changeStatus === "new" || r.changeStatus === "changed").length
}

function getStatusHeader(build: ScreenshotTest): string {
  switch (build.status) {
    case "pending":
      return "⏳ $${\\color{goldenrod}Pending}$$"
    case "running":
      return "🚧 $${\\color{goldenrod}Running}$$"
    case "no_changes":
      return "🟢 $${\\color{green}Unchanged}$$"
    case "unapproved":
      return "🟡 $${\\color{goldenrod}Pending}$$"
    case "approved":
      return "✅ $${\\color{green}Approved}$$"
    case "denied":
      return "❌ $${\\color{red}Denied}$$"
    case "failed":
      return "❗ $${\\color{red}Failed}$$"
    default:
      throw new Error(`Unknown build status: ${build.status}`)
  }
}

function getChangeStatusText(testResult: TestResult): string {
  switch (testResult.changeStatus) {
    case "new":
      return `🟡 New`
    case "unchanged":
      return `🟢 Unchanged`
    case "changed": {
      const changePct = testResult.diffRatio ? ` (${(testResult.diffRatio * 100).toFixed(2)}%)` : ""
      return `🟡 Changed${changePct}`
    }
    case "failed":
      return `🔴 Failed`
    default:
      throw new Error(`Unknown change status: ${testResult.changeStatus}`)
  }
}

function getSortedTestResults(testResults: TestResult[]): TestResult[] {
  // Create a copy of test results sorted by change status
  // (failed, changed, new, unchanged), then by name
  const statusOrder: { [key: string]: number } = {
    failed: 0,
    changed: 1,
    new: 2,
    unchanged: 3,
  }
  const sortedTestResults = testResults.slice().sort((a, b) => {
    const statusA = statusOrder[a.changeStatus] ?? 99
    const statusB = statusOrder[b.changeStatus] ?? 99

    if (statusA !== statusB) {
      return statusA - statusB // Sort by status priority
    }
    // If statuses are the same, sort by name alphabetically
    return a.name.localeCompare(b.name)
  })

  return sortedTestResults
}
