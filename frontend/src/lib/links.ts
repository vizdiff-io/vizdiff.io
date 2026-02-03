type VCSProvider = "github" | "gitlab"

/**
 * Extract owner/group and repo/project from a VCS URL
 */
function parseRepoUrl(
  repoUrl: string,
): { provider: VCSProvider; owner: string; repo: string; host: string } | null {
  // Match: https://github.com/owner/repo or https://gitlab.com/group/project
  const match = /https?:\/\/([^/]+)\/([^/]+)\/([^/]+)/.exec(repoUrl)
  if (match?.[1] && match[2] && match[3]) {
    const host = match[1]
    const owner = match[2]
    const repo = match[3].replace(/\.git$/, "")
    const provider: VCSProvider = host.includes("gitlab") ? "gitlab" : "github"
    return { provider, owner, repo, host }
  }
  return null
}

/**
 * Get the URL for a commit
 * GitHub: /owner/repo/commit/{sha} or /owner/repo/pull/{pr}/commits/{sha}
 * GitLab: /group/project/-/commit/{sha} or /group/project/-/merge_requests/{mr}/commits/{sha}
 */
export function getCommitUrl(
  commitSha: string,
  repoUrl: string | undefined,
  prNumber?: number,
): string {
  if (!repoUrl || !commitSha) {
    return "#"
  }

  const parsed = parseRepoUrl(repoUrl)
  if (!parsed) {
    return "#"
  }

  const { provider, owner, repo, host } = parsed
  const baseUrl = `https://${host}/${owner}/${repo}`

  if (provider === "gitlab") {
    if (prNumber) {
      return `${baseUrl}/-/merge_requests/${prNumber}/diffs?commit_id=${commitSha}`
    }
    return `${baseUrl}/-/commit/${commitSha}`
  } else {
    if (prNumber) {
      return `${baseUrl}/pull/${prNumber}/commits/${commitSha}`
    }
    return `${baseUrl}/commit/${commitSha}`
  }
}

/**
 * Get the URL for a branch
 * GitHub: /owner/repo/tree/{branch}
 * GitLab: /group/project/-/tree/{branch}
 */
export function getBranchUrl(branch: string, repoUrl: string | undefined): string {
  if (!repoUrl || !branch) {
    return "#"
  }

  const parsed = parseRepoUrl(repoUrl)
  if (!parsed) {
    return "#"
  }

  const { provider, owner, repo, host } = parsed
  const baseUrl = `https://${host}/${owner}/${repo}`

  // Encode branch name segments separately to preserve slashes
  const encodedBranch = branch
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")

  if (provider === "gitlab") {
    return `${baseUrl}/-/tree/${encodedBranch}`
  } else {
    return `${baseUrl}/tree/${encodedBranch}`
  }
}

/**
 * Get the URL for a pull/merge request
 * GitHub: /owner/repo/pull/{number}
 * GitLab: /group/project/-/merge_requests/{number}
 */
export function getPullRequestUrl(
  prNumber: number | undefined,
  repoUrl: string | undefined,
): string {
  if (!repoUrl || !prNumber) {
    return "#"
  }

  const parsed = parseRepoUrl(repoUrl)
  if (!parsed) {
    return "#"
  }

  const { provider, owner, repo, host } = parsed
  const baseUrl = `https://${host}/${owner}/${repo}`

  if (provider === "gitlab") {
    return `${baseUrl}/-/merge_requests/${prNumber}`
  } else {
    return `${baseUrl}/pull/${prNumber}`
  }
}
