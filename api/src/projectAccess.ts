import { Project } from "shared"

import { Database } from "./database"

/**
 * Get all `projects.id`s that the user has access to, including both directly owned projects
 * and those accessible via GitHub repo access
 * @param db TypeORM database connection
 * @param userId User ID to check access for
 * @returns Array of project IDs that the user has access to
 */
export async function getAccessibleProjectIds(
  db: Awaited<ReturnType<typeof Database>>,
  userId: number,
): Promise<number[]> {
  const projectTable = db.getRepository(Project)

  // Get both directly owned projects and those accessible via GitHub repo access
  const accessibleProjectsRaw = await projectTable
    .createQueryBuilder("project")
    .select("DISTINCT project.id", "id")
    .leftJoin("user_github_repo_access", "access", "access.github_repo_id = project.github_repo_id")
    .where(
      // User either owns the project directly OR has access via GitHub repo
      "(project.user_id = :userId OR access.user_id = :userId)",
      { userId },
    )
    .getRawMany<{ id: number }>()

  // Map the raw results to get an array of IDs
  return accessibleProjectsRaw.map((project) => project.id)
}
