import { randomBytes } from "node:crypto"
import { isValidProjectKey, Project, User } from "shared"
import { IsNull, type DataSource } from "typeorm"

import { GITLAB_HOST } from "./environment"
import { UploadAuthError } from "./gitlabOidc"

export async function resolveOidcProject(
  db: DataSource,
  repoId: number,
  repoPath: string,
  key: string,
  owners: Map<string, string>,
  defaultHost = GITLAB_HOST,
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
  // Null hosts predate multi-host support and belong to the configured default host.
  // Include those rows without rewriting identities or separating baseline history.
  const repositories =
    defaultHost === "https://gitlab.com"
      ? [identity, { ...identity, gitlabHost: IsNull() }]
      : [identity]
  const existing = await table.findOne({
    where: repositories.map((repo) => ({ ...repo, key })),
    order: { createdAt: "ASC", id: "ASC" },
  })
  if (existing) {
    return existing
  }
  const sibling = await table.findOne({
    where: repositories,
    order: { createdAt: "ASC", id: "ASC" },
  })
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
