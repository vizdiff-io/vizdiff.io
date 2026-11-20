import type { DataSource, EntityManager } from "typeorm"

export async function withGitLabStatusLock<T>(
  db: DataSource,
  testId: number,
  publish: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  return db.transaction(async (manager) => {
    // API and worker processes must hold the same lock through the GitLab request.
    await manager.query("SELECT pg_advisory_xact_lock(hashtext('vizdiff:gitlab-status'), $1)", [
      testId,
    ])
    return publish(manager)
  })
}
