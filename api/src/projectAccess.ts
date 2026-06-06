import { Project } from "shared"

import { Database } from "./database"

/**
 * Returns the IDs of all projects in the deployment.
 *
 * Authorization model: any authenticated user can view and manage all projects (confirmed with the
 * product owner). Per-user VCS-membership scoping has been removed for the self-hosted
 * deployment, so this returns every project ID.
 */
export async function getAccessibleProjectIds(
  db: Awaited<ReturnType<typeof Database>>,
  _userId: number,
): Promise<number[]> {
  const projectTable = db.getRepository(Project)
  const rows = await projectTable
    .createQueryBuilder("project")
    .select("project.id", "id")
    .getRawMany<{ id: number }>()
  return rows.map((row) => row.id)
}
