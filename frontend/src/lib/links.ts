// Get the GitHub URL for a commit and project
export function getCommitUrl(
  commitSha: string,
  githubRepoUrl: string | undefined,
  prNumber?: number,
): string {
  if (!githubRepoUrl || !commitSha) {
    return "#"
  }

  // Extract owner and repo name from GitHub URL
  const match = /github\.com\/([^/]+)\/([^/]+)/.exec(githubRepoUrl)
  if (!match) {
    return "#"
  }

  const [, owner, repo] = match

  // Construct URL based on presence of prNumber
  if (prNumber) {
    return `https://github.com/${owner}/${repo}/pull/${prNumber}/commits/${commitSha}`
  } else {
    return `https://github.com/${owner}/${repo}/commit/${commitSha}`
  }
}

export function getBranchUrl(branch: string, githubRepoUrl: string | undefined): string {
  if (!githubRepoUrl || !branch) {
    return "#"
  }

  // Extract owner and repo name from GitHub URL
  const match = /github\.com\/([^/]+)\/([^/]+)/.exec(githubRepoUrl)
  if (!match) {
    return "#"
  }

  const [, owner, repo] = match
  // Encode branch name segments separately to preserve slashes
  const encodedBranch = branch
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")

  return `https://github.com/${owner}/${repo}/tree/${encodedBranch}`
}

export function getPullRequestUrl(
  prNumber: number | undefined,
  githubRepoUrl: string | undefined,
): string {
  if (!githubRepoUrl || !prNumber) {
    return "#"
  }

  // Extract owner and repo name from GitHub URL
  const match = /github\.com\/([^/]+)\/([^/]+)/.exec(githubRepoUrl)
  if (!match) {
    return "#"
  }

  const [, owner, repo] = match
  return `https://github.com/${owner}/${repo}/pull/${prNumber}`
}
