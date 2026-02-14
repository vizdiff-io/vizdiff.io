import { Project, User } from "shared"

import { Database } from "./database"
import { GITLAB_HOST } from "./environment"

/**
 * Get all `projects.id`s that the user has access to, including both directly owned projects
 * and those accessible via GitHub/GitLab repo access. For GitLab projects, access is scoped
 * by project.gitlab_host to prevent cross-host authorization bypass when a single VizDiff
 * deployment serves multiple GitLab instances.
 */
export async function getAccessibleProjectIds(
  db: Awaited<ReturnType<typeof Database>>,
  userId: number,
): Promise<number[]> {
  const projectTable = db.getRepository(Project)

  // Get both directly owned projects and those accessible via GitHub/GitLab repo access
  const accessibleProjectsRaw = await projectTable
    .createQueryBuilder("project")
    .select("DISTINCT project.id", "id")
    .leftJoin(
      "user_github_repo_access",
      "gh_access",
      "gh_access.github_repo_id = project.repo_id AND project.vcs_provider = 'github'",
    )
    .leftJoin(
      "user_gitlab_project_access",
      "gl_access",
      "gl_access.gitlab_project_id = project.repo_id AND project.vcs_provider = 'gitlab' AND gl_access.gitlab_host = project.gitlab_host AND project.gitlab_host IS NOT NULL",
    )
    .where(
      // User either owns the project directly OR has access via GitHub/GitLab repo
      "(project.user_id = :userId OR gh_access.user_id = :userId OR gl_access.user_id = :userId)",
      { userId },
    )
    .getRawMany<{ id: number }>()

  // Map the raw results to get an array of IDs
  return accessibleProjectsRaw.map((project) => project.id)
}
