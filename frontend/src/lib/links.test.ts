import { describe, it, expect } from "vitest"

import { getCommitUrl, getBranchUrl, getPullRequestUrl } from "./links"

describe("links", () => {
  describe("getCommitUrl", () => {
    describe("GitHub URLs", () => {
      const githubRepoUrl = "https://github.com/owner/repo"

      it("returns commit URL for GitHub", () => {
        const url = getCommitUrl("abc123", githubRepoUrl)
        expect(url).toBe("https://github.com/owner/repo/commit/abc123")
      })

      it("returns PR commit URL for GitHub when prNumber provided", () => {
        const url = getCommitUrl("abc123", githubRepoUrl, 42)
        expect(url).toBe("https://github.com/owner/repo/pull/42/commits/abc123")
      })

      it("handles .git suffix in URL", () => {
        const url = getCommitUrl("abc123", "https://github.com/owner/repo.git")
        expect(url).toBe("https://github.com/owner/repo/commit/abc123")
      })
    })

    describe("GitLab URLs", () => {
      const gitlabRepoUrl = "https://gitlab.com/group/project"

      it("returns commit URL for GitLab", () => {
        const url = getCommitUrl("abc123", gitlabRepoUrl)
        expect(url).toBe("https://gitlab.com/group/project/-/commit/abc123")
      })

      it("returns MR commit URL for GitLab when prNumber provided", () => {
        const url = getCommitUrl("abc123", gitlabRepoUrl, 42)
        expect(url).toBe(
          "https://gitlab.com/group/project/-/merge_requests/42/diffs?commit_id=abc123",
        )
      })

      it("handles self-hosted GitLab", () => {
        const url = getCommitUrl("abc123", "https://gitlab.company.com/group/project")
        expect(url).toBe("https://gitlab.company.com/group/project/-/commit/abc123")
      })
    })

    describe("edge cases", () => {
      it("returns # for missing repoUrl", () => {
        expect(getCommitUrl("abc123", undefined)).toBe("#")
        expect(getCommitUrl("abc123", "")).toBe("#")
      })

      it("returns # for missing commitSha", () => {
        expect(getCommitUrl("", "https://github.com/owner/repo")).toBe("#")
      })

      it("returns # for malformed URL", () => {
        expect(getCommitUrl("abc123", "not-a-url")).toBe("#")
        expect(getCommitUrl("abc123", "https://github.com/owner")).toBe("#")
      })
    })
  })

  describe("getBranchUrl", () => {
    describe("GitHub URLs", () => {
      const githubRepoUrl = "https://github.com/owner/repo"

      it("returns branch URL for GitHub", () => {
        const url = getBranchUrl("main", githubRepoUrl)
        expect(url).toBe("https://github.com/owner/repo/tree/main")
      })

      it("handles branch names with slashes", () => {
        const url = getBranchUrl("feature/my-feature", githubRepoUrl)
        expect(url).toBe("https://github.com/owner/repo/tree/feature/my-feature")
      })

      it("encodes special characters in branch names", () => {
        const url = getBranchUrl("feature/test branch", githubRepoUrl)
        expect(url).toBe("https://github.com/owner/repo/tree/feature/test%20branch")
      })
    })

    describe("GitLab URLs", () => {
      const gitlabRepoUrl = "https://gitlab.com/group/project"

      it("returns branch URL for GitLab", () => {
        const url = getBranchUrl("main", gitlabRepoUrl)
        expect(url).toBe("https://gitlab.com/group/project/-/tree/main")
      })

      it("handles branch names with slashes", () => {
        const url = getBranchUrl("feature/my-feature", gitlabRepoUrl)
        expect(url).toBe("https://gitlab.com/group/project/-/tree/feature/my-feature")
      })
    })

    describe("edge cases", () => {
      it("returns # for missing repoUrl", () => {
        expect(getBranchUrl("main", undefined)).toBe("#")
        expect(getBranchUrl("main", "")).toBe("#")
      })

      it("returns # for missing branch", () => {
        expect(getBranchUrl("", "https://github.com/owner/repo")).toBe("#")
      })
    })
  })

  describe("getPullRequestUrl", () => {
    describe("GitHub URLs", () => {
      const githubRepoUrl = "https://github.com/owner/repo"

      it("returns PR URL for GitHub", () => {
        const url = getPullRequestUrl(42, githubRepoUrl)
        expect(url).toBe("https://github.com/owner/repo/pull/42")
      })
    })

    describe("GitLab URLs", () => {
      const gitlabRepoUrl = "https://gitlab.com/group/project"

      it("returns MR URL for GitLab", () => {
        const url = getPullRequestUrl(42, gitlabRepoUrl)
        expect(url).toBe("https://gitlab.com/group/project/-/merge_requests/42")
      })

      it("handles self-hosted GitLab", () => {
        const url = getPullRequestUrl(42, "https://gitlab.company.com/group/project")
        expect(url).toBe("https://gitlab.company.com/group/project/-/merge_requests/42")
      })
    })

    describe("edge cases", () => {
      it("returns # for missing repoUrl", () => {
        expect(getPullRequestUrl(42, undefined)).toBe("#")
        expect(getPullRequestUrl(42, "")).toBe("#")
      })

      it("returns # for missing prNumber", () => {
        expect(getPullRequestUrl(undefined, "https://github.com/owner/repo")).toBe("#")
      })

      it("returns # for zero prNumber", () => {
        expect(getPullRequestUrl(0, "https://github.com/owner/repo")).toBe("#")
      })
    })
  })

  describe("provider detection", () => {
    it("detects github.com as GitHub", () => {
      const url = getCommitUrl("abc", "https://github.com/owner/repo")
      expect(url).toContain("/commit/")
      expect(url).not.toContain("/-/commit/")
    })

    it("detects gitlab.com as GitLab", () => {
      const url = getCommitUrl("abc", "https://gitlab.com/group/project")
      expect(url).toContain("/-/commit/")
    })

    it("detects self-hosted GitLab by hostname containing gitlab", () => {
      const url = getCommitUrl("abc", "https://gitlab.mycompany.com/group/project")
      expect(url).toContain("/-/commit/")
    })

    it("treats unknown hosts as GitHub", () => {
      const url = getCommitUrl("abc", "https://code.example.com/owner/repo")
      expect(url).toContain("/commit/")
      expect(url).not.toContain("/-/commit/")
    })
  })
})
