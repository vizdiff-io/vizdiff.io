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
  const statusText =
    changeCount === 0 ? "$${\\color{green}Approved}$$" : "$${\\color{goldenrod}Pending}$$"
  let summary =
    `|**${testCount}**|**${changeCount}**|**${statusText}**|\n` +
    `|-|-|:-:|\n` +
    `|Tests|Changes|Status|\n` +
    `Review [build #${build.buildNumber}](https://vizdiff.io/build?id=${build.id}) on vizdiff.io for a detailed comparison.`
  if (failedCount > 0) {
    summary += `\n---\n ⚠️ ${failedCount} test${failedCount === 1 ? "" : "s"} failed to render.`
  }

  // Create the detailed text that appears below the summary on this status check's details page
  let text = "### Visual Tests\n"
  for (const testResult of testResults) {
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
      text += `> <img src="${FAILED_IMAGE_URL}" alt="Failed" width="250" />\n`
    } else {
      text +=
        `> <a href="${testResult.newImageUrl}">` +
        `<img src="${testResult.newImageUrl}" alt="${testResult.screenshotTest.commitSha}" width="250" />` +
        `</a>\n`
    }
    // Status line
    switch (testResult.changeStatus) {
      case "new":
        text += `> 🟡 New\n`
        break
      case "unchanged":
        text += `> 🟢 Unchanged\n`
        break
      case "changed":
        text += `> 🟡 Changed\n`
        break
      case "failed":
        text += `> 🔴 Failed\n`
        break
      default:
        throw new Error(`Unknown change status: ${testResult.changeStatus}`)
    }
    text += `\n`
  }

  return { title, summary, text }
}

export function createMarkdownForBuildApproval(
  build: ScreenshotTest,
  testResults: TestResult[],
  approved: boolean,
  username: string,
): { title: string; summary: string; text?: string } {
  const status = approved ? "approved" : "denied"
  const changeCount = getChangeCount(testResults)
  const title = `${changeCount} change${changeCount === 1 ? "" : "s"} ${status} by ${username}.`

  let { summary } = createMarkdownForBuildResult(build, testResults)
  summary += `\n---\n ${approved ? "✅ Approved" : "❌ Rejected"} by ${username}`

  return { title, summary, text: undefined }
}

function getChangeCount(testResults: TestResult[]): number {
  return testResults.filter((r) => r.changeStatus === "new" || r.changeStatus === "changed").length
}
