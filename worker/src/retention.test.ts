import type { DataSource } from "typeorm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { runRetentionSweep, selectReapableBuilds } from "./retention"

const { mockDeleteObjectsByPrefixes, mockQuery, mockDelete } = vi.hoisted(() => ({
  mockDeleteObjectsByPrefixes: vi.fn(),
  mockQuery: vi.fn(),
  mockDelete: vi.fn(),
}))

vi.mock("./s3", () => ({
  deleteObjectsByPrefixes: mockDeleteObjectsByPrefixes,
}))

const mockDb = {
  query: mockQuery,
  getRepository: () => ({ delete: mockDelete }),
} as unknown as DataSource

vi.mock("./database", () => ({
  Database: () => Promise.resolve(mockDb),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockDeleteObjectsByPrefixes.mockResolvedValue({ deleted: 0, errors: 0 })
  mockDelete.mockResolvedValue({ affected: 1 })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("selectReapableBuilds", () => {
  it("passes keepLastN, an age cutoff, and the limit to the query", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-12T00:00:00Z"))
    mockQuery.mockResolvedValue([])

    await selectReapableBuilds(mockDb, { retentionDays: 90, keepLastN: 5, limit: 200 })

    expect(mockQuery).toHaveBeenCalledTimes(1)
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    // keepLastN, cutoff Date, limit — in that order.
    expect(params[0]).toBe(5)
    expect(params[1]).toBeInstanceOf(Date)
    const cutoff = params[1] as Date
    const expectedCutoff = new Date("2026-06-12T00:00:00Z").getTime() - 90 * 24 * 60 * 60 * 1000
    expect(cutoff.getTime()).toBe(expectedCutoff)
    expect(params[2]).toBe(200)
    // Selection must exclude in-flight builds and rank per project.
    expect(sql).toContain("status NOT IN ('pending', 'running')")
    expect(sql).toContain("PARTITION BY project_id")
    expect(sql).toContain("rn > $1")
  })

  it("returns the rows from the query", async () => {
    const rows = [{ id: 3, project_id: 1, upload_id: "u3" }]
    mockQuery.mockResolvedValue(rows)
    const result = await selectReapableBuilds(mockDb, {
      retentionDays: 30,
      keepLastN: 1,
      limit: 10,
    })
    expect(result).toEqual(rows)
  })
})

describe("runRetentionSweep", () => {
  it("deletes S3 objects before the DB row, for each selected build", async () => {
    mockQuery.mockResolvedValue([
      { id: 10, project_id: 1, upload_id: "abc" },
      { id: 11, project_id: 2, upload_id: "def" },
    ])
    mockDeleteObjectsByPrefixes.mockResolvedValue({ deleted: 4, errors: 0 })

    const order: string[] = []
    mockDeleteObjectsByPrefixes.mockImplementation((prefixes: string[]) => {
      order.push(`s3:${prefixes[0]}`)
      return Promise.resolve({ deleted: 4, errors: 0 })
    })
    mockDelete.mockImplementation((criteria: { id: number }) => {
      order.push(`db:${criteria.id}`)
      return Promise.resolve({ affected: 1 })
    })

    const result = await runRetentionSweep()

    expect(result.buildsDeleted).toBe(2)
    expect(result.objectsDeleted).toBe(8)
    // S3 prefix for a build is projects/<projectId>/screenshots/<uploadId>/
    expect(mockDeleteObjectsByPrefixes).toHaveBeenCalledWith(["projects/1/screenshots/abc/"])
    expect(mockDeleteObjectsByPrefixes).toHaveBeenCalledWith(["projects/2/screenshots/def/"])
    // S3 first, then DB row, per build.
    expect(order).toEqual([
      "s3:projects/1/screenshots/abc/",
      "db:10",
      "s3:projects/2/screenshots/def/",
      "db:11",
    ])
  })

  it("does nothing when no builds are eligible", async () => {
    mockQuery.mockResolvedValue([])
    const result = await runRetentionSweep()
    expect(result).toEqual({ buildsDeleted: 0, objectsDeleted: 0, objectErrors: 0 })
    expect(mockDeleteObjectsByPrefixes).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it("continues the sweep when one build fails, and does not delete its row", async () => {
    mockQuery.mockResolvedValue([
      { id: 10, project_id: 1, upload_id: "abc" },
      { id: 11, project_id: 2, upload_id: "def" },
    ])
    mockDeleteObjectsByPrefixes.mockImplementation((prefixes: string[]) => {
      if (prefixes[0] === "projects/1/screenshots/abc/") {
        return Promise.reject(new Error("S3 down"))
      }
      return Promise.resolve({ deleted: 2, errors: 0 })
    })

    const result = await runRetentionSweep()

    // Only the second build was reaped; the failed one's row was never deleted.
    expect(result.buildsDeleted).toBe(1)
    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockDelete).toHaveBeenCalledWith({ id: 11 })
  })

  it("counts S3 object errors without failing the build deletion", async () => {
    mockQuery.mockResolvedValue([{ id: 10, project_id: 1, upload_id: "abc" }])
    mockDeleteObjectsByPrefixes.mockResolvedValue({ deleted: 3, errors: 2 })

    const result = await runRetentionSweep()
    expect(result).toEqual({ buildsDeleted: 1, objectsDeleted: 3, objectErrors: 2 })
    expect(mockDelete).toHaveBeenCalledWith({ id: 10 })
  })
})
