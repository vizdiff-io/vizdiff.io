import { randomBytes } from "node:crypto"
import { isValidProjectKey, Project, User } from "shared"
import type { DataSource } from "typeorm"

import { UploadAuthError } from "./gitlabOidc"

export async function resolveOidcProject(
  db: DataSource,
  repoId: number,
  repoPath: string,
  key: string,
  owners: Map<string, string>,
): Promise<Project> {
  const email = owners.get(repoPath)
  if (!email) {
    throw new UploadAuthError("Repository is not configured in GITLAB_OIDC_AUTO_CREATE")
  }
  if (key && !isValidProjectKey(key)) {
    throw new UploadAuthError("Invalid project key", 400)
  }
  const table = db.getRepository(Project)
  const identity = { vcsProvider: "gitlab" as const, repoId, gitlabHost: "https://gitlab.com" }
  const existing = await table.findOneBy({ ...identity, key })
  if (existing) {
    return existing
  }
  const sibling = await table.findOne({ where: identity, order: { createdAt: "ASC", id: "ASC" } })
  const owner = sibling?.user ?? (await db.getRepository(User).findOneBy({ email }))
  if (!owner) {
    throw new UploadAuthError(
      "GITLAB_OIDC_AUTO_CREATE must name an existing VizDiff user for this repository",
    )
  }
  await table
    .createQueryBuilder()
    .insert()
    .values({
      ...identity,
      key,
      user: owner,
      name: key ? `${repoPath} (${key})` : repoPath,
      repoUrl: `https://gitlab.com/${repoPath}`,
      token: randomBytes(32).toString("hex"),
    })
    .orIgnore()
    .execute()
  const created = await table.findOneByOrFail({ ...identity, key })
  return created
}
