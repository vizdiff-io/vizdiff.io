type VCSProvider = "github" | "gitlab"

/**
 * Extract owner/group and repo/project from a VCS URL
 * @param repoUrl The repository URL
 * @param vcsProvider Optional VCS provider. If provided, this is used instead of inferring from the URL.
 *                    This is important for self-hosted GitLab instances where the hostname doesn't contain "gitlab".
 */
function parseRepoUrl(
  repoUrl: string,
  vcsProvider?: VCSProvider,
): { provider: VCSProvider; owner: string; repo: string; host: string } | null {
  // Extract hostname and path
  const match = /https?:\/\/([^/]+)(\/.*)?/.exec(repoUrl)
  if (!match?.[1]) {
    return null
  }

  const host = match[1]
  const fullPath = match[2] ?? ""

  // Split path into segments, filter out empty segments
  const pathSegments = fullPath.split("/").filter((segment) => segment.length > 0)

  // Remove .git suffix from the last segment if present
  if (pathSegments.length > 0) {
    const lastIndex = pathSegments.length - 1
    const lastSegment = pathSegments[lastIndex]
    if (lastSegment) {
      pathSegments[lastIndex] = lastSegment.replace(/\.git$/, "")
    }
  }

  // Determine provider (use provided vcsProvider if available, otherwise infer from hostname)
  const provider: VCSProvider = vcsProvider ?? (host.includes("gitlab") ? "gitlab" : "github")

  if (provider === "github") {
    // GitHub URLs always have exactly 2 path segments: owner/repo
    if (pathSegments.length !== 2) {
      return null
    }
    const owner = pathSegments[0]
    const repo = pathSegments[1]
    if (!owner || !repo) {
      return null
    }
    return {
      provider,
      owner,
      repo,
      host,
    }
  } else {
    // GitLab URLs can have 2+ path segments: group/project or group/subgroup/project, etc.
    // The last segment is the project name, all preceding segments form the group path
    if (pathSegments.length < 2) {
      return null
    }
    const repo = pathSegments[pathSegments.length - 1]
    if (!repo) {
      return null
    }
    const owner = pathSegments.slice(0, -1).join("/")
    return {
      provider,
      owner,
      repo,
      host,
    }
  }
}

/**
 * Get the URL for a commit
 * GitHub: /owner/repo/commit/{sha} or /owner/repo/pull/{pr}/commits/{sha}
 * GitLab: /group/project/-/commit/{sha} or /group/project/-/merge_requests/{mr}/commits/{sha}
 * @param commitSha The commit SHA
 * @param repoUrl The repository URL
 * @param prNumber Optional PR/MR number
 * @param vcsProvider Optional VCS provider. If provided, this is used instead of inferring from the URL.
 *                    This is important for self-hosted GitLab instances where the hostname doesn't contain "gitlab".
 */
export function getCommitUrl(
  commitSha: string,
  repoUrl: string | undefined,
  prNumber?: number,
  vcsProvider?: VCSProvider,
): string {
  if (!repoUrl || !commitSha) {
    return "#"
  }

  const parsed = parseRepoUrl(repoUrl, vcsProvider)
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
 * @param branch The branch name
 * @param repoUrl The repository URL
 * @param vcsProvider Optional VCS provider. If provided, this is used instead of inferring from the URL.
 *                    This is important for self-hosted GitLab instances where the hostname doesn't contain "gitlab".
 */
export function getBranchUrl(
  branch: string,
  repoUrl: string | undefined,
  vcsProvider?: VCSProvider,
): string {
  if (!repoUrl || !branch) {
    return "#"
  }

  const parsed = parseRepoUrl(repoUrl, vcsProvider)
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
 * @param prNumber The PR/MR number
 * @param repoUrl The repository URL
 * @param vcsProvider Optional VCS provider. If provided, this is used instead of inferring from the URL.
 *                    This is important for self-hosted GitLab instances where the hostname doesn't contain "gitlab".
 */
export function getPullRequestUrl(
  prNumber: number | undefined,
  repoUrl: string | undefined,
  vcsProvider?: VCSProvider,
): string {
  if (!repoUrl || !prNumber) {
    return "#"
  }

  const parsed = parseRepoUrl(repoUrl, vcsProvider)
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
