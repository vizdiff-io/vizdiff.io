import { Project, User } from "shared"
import { afterAll, describe, expect, it } from "vitest"

import { Database } from "./database"
import { resolveOidcProject } from "./gitlabOidcProjects"

describe("OIDC auto-created project ownership", () => {
  afterAll(async () => {
    const db = await Database()
    if (db.isInitialized) {
      await db.destroy()
    }
  })
  it("requires allow-list configuration and an existing owner for the first project", async () => {
    const db = await Database()
    await expect(resolveOidcProject(db, 42, "example/site", "ui", new Map())).rejects.toThrow(
      "GITLAB_OIDC_AUTO_CREATE",
    )
    await expect(
      resolveOidcProject(
        db,
        42,
        "example/site",
        "ui",
        new Map([["example/site", "unknown@example.com"]]),
      ),
    ).rejects.toThrow("GITLAB_OIDC_AUTO_CREATE")
  })
  it("uses configured owners first, inherits oldest siblings, and handles concurrent uploads", async () => {
    const db = await Database()
    const owner = await db
      .getRepository(User)
      .save({ authSubject: "oidc-owner", email: "owner@example.com" })
    const mapping = new Map([["example/site", "owner@example.com"]])
    const [a, b] = await Promise.all([
      resolveOidcProject(db, 43, "example/site", "ui", mapping),
      resolveOidcProject(db, 43, "example/site", "ui", mapping),
    ])
    expect(a.id).toBe(b.id)
    expect(a.user.id).toBe(owner.id)
    const next = await resolveOidcProject(
      db,
      43,
      "example/site",
      "docs",
      new Map([["example/site", "unknown@example.com"]]),
    )
    expect(next.user.id).toBe(owner.id)
    expect(await db.getRepository(Project).countBy({ repoId: 43 })).toBe(2)
    await expect(resolveOidcProject(db, 43, "example/site", "bad key", mapping)).rejects.toThrow()
  })
  it("inherits the oldest same-host repository owner and preserves existing credentials", async () => {
    const db = await Database()
    const older = await db
      .getRepository(User)
      .save({ authSubject: "older-owner", email: "older@example.com" })
    const newer = await db
      .getRepository(User)
      .save({ authSubject: "newer-owner", email: "newer@example.com" })
    const identity = {
      vcsProvider: "gitlab" as const,
      repoId: 44,
      repoUrl: "https://gitlab.com/example/site",
      gitlabHost: "https://gitlab.com",
    }
    await db.getRepository(Project).save({
      ...identity,
      user: older,
      key: "first",
      name: "first",
      token: "first-secret",
      createdAt: new Date("2020-01-01"),
    })
    await db.getRepository(Project).save({
      ...identity,
      user: newer,
      key: "second",
      name: "second",
      token: "second-secret",
      createdAt: new Date("2021-01-01"),
    })
    await db.getRepository(Project).save({
      ...identity,
      gitlabHost: "https://gitlab.example.com",
      user: newer,
      key: "foreign",
      name: "foreign",
      token: "foreign-secret",
      createdAt: new Date("2019-01-01"),
    })
    const map = new Map([["example/site", "newer@example.com"]])
    const [a, b] = await Promise.all([
      resolveOidcProject(db, 44, "example/site", "a", map),
      resolveOidcProject(db, 44, "example/site", "b", map),
    ])
    expect(a.user.id).toBe(older.id)
    expect(b.user.id).toBe(older.id)
    const existing = await resolveOidcProject(db, 44, "example/site", "second", map)
    expect(existing.user.id).toBe(newer.id)
    expect(existing.token).toBe("second-secret")
  })
})
