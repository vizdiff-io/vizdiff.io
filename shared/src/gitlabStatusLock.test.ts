import type { DataSource } from "typeorm"
import { describe, expect, it, vi } from "vitest"

import { withGitLabStatusLock } from "./gitlabStatusLock"

describe("withGitLabStatusLock", () => {
  it("acquires the build lock before publishing on the transaction manager", async () => {
    const manager = { query: vi.fn().mockResolvedValue([]) }
    const publish = vi.fn().mockImplementation(async (received) => {
      expect(received).toBe(manager)
      expect(manager.query).toHaveBeenCalledWith(
        "SELECT pg_advisory_xact_lock(hashtext('vizdiff:gitlab-status'), $1)",
        [7],
      )
      return "published"
    })
    const transaction = vi.fn().mockImplementation(async (callback) => callback(manager))

    await expect(
      withGitLabStatusLock({ transaction } as unknown as DataSource, 7, publish),
    ).resolves.toBe("published")
    expect(transaction).toHaveBeenCalledTimes(1)
  })

  it("propagates publication failures so TypeORM rolls back and releases the transaction lock", async () => {
    const failure = new Error("GitLab unavailable")
    const transaction = vi
      .fn()
      .mockImplementation(async (callback) => callback({ query: vi.fn().mockResolvedValue([]) }))

    await expect(
      withGitLabStatusLock({ transaction } as unknown as DataSource, 7, async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
  })

  it("does not publish when acquiring the lock fails", async () => {
    const failure = new Error("database unavailable")
    const publish = vi.fn()
    const transaction = vi
      .fn()
      .mockImplementation(async (callback) =>
        callback({ query: vi.fn().mockRejectedValue(failure) }),
      )

    await expect(
      withGitLabStatusLock({ transaction } as unknown as DataSource, 7, publish),
    ).rejects.toBe(failure)
    expect(publish).not.toHaveBeenCalled()
  })
})
