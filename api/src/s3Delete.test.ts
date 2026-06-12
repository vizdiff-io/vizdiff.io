import { describe, expect, it, vi } from "vitest"

import { deleteObjectsByPrefixes, projectKeyPrefix } from "./s3"

// Constructable command mocks that capture their input so we can assert on the requests issued.
vi.mock("@aws-sdk/client-s3", () => {
  class S3Client {
    send = vi.fn()
  }
  class GetObjectCommand {
    constructor(public input: unknown) {}
  }
  class ListObjectsV2Command {
    readonly type = "list"
    constructor(public input: { Bucket: string; Prefix: string; ContinuationToken?: string }) {}
  }
  class DeleteObjectsCommand {
    readonly type = "delete"
    constructor(public input: { Bucket: string; Delete: { Objects: { Key: string }[] } }) {}
  }
  return { S3Client, GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand }
})

interface FakeCommand {
  type?: string
  input: {
    Bucket: string
    Prefix?: string
    ContinuationToken?: string
    Delete?: { Objects: { Key: string }[] }
  }
}

/** Build a fake S3 client whose `send` is driven by a queue of List responses. */
function fakeClient(
  listResponses: Array<{
    Contents?: { Key: string }[]
    IsTruncated?: boolean
    NextContinuationToken?: string
  }>,
  deleteErrors: Record<string, string> = {},
) {
  const sent: FakeCommand[] = []
  let listIdx = 0
  const send = vi.fn((command: FakeCommand) => {
    sent.push(command)
    if (command.type === "list") {
      return Promise.resolve(listResponses[listIdx++] ?? { Contents: [] })
    }
    // delete
    const objects = command.input.Delete?.Objects ?? []
    const Errors = objects
      .filter((o) => o.Key in deleteErrors)
      .map((o) => ({ Key: o.Key, Message: deleteErrors[o.Key] }))
    return Promise.resolve({ Errors })
  })
  return { client: { send } as unknown as Parameters<typeof deleteObjectsByPrefixes>[1], sent }
}

describe("projectKeyPrefix", () => {
  it("builds the canonical project prefix", () => {
    expect(projectKeyPrefix(42)).toBe("projects/42/")
  })
})

describe("deleteObjectsByPrefixes", () => {
  it("lists and batch-deletes all objects under a prefix", async () => {
    const { client, sent } = fakeClient([
      { Contents: [{ Key: "projects/1/a.png" }, { Key: "projects/1/b.png" }], IsTruncated: false },
    ])

    const result = await deleteObjectsByPrefixes(["projects/1/"], client, "bucket")

    expect(result).toEqual({ deleted: 2, errors: 0 })
    const list = sent.find((c) => c.type === "list")
    expect(list?.input.Prefix).toBe("projects/1/")
    const del = sent.find((c) => c.type === "delete")
    expect(del?.input.Delete?.Objects.map((o) => o.Key)).toEqual([
      "projects/1/a.png",
      "projects/1/b.png",
    ])
  })

  it("follows pagination across truncated list pages", async () => {
    const { client, sent } = fakeClient([
      { Contents: [{ Key: "projects/1/a.png" }], IsTruncated: true, NextContinuationToken: "tok" },
      { Contents: [{ Key: "projects/1/b.png" }], IsTruncated: false },
    ])

    const result = await deleteObjectsByPrefixes(["projects/1/"], client, "bucket")

    expect(result).toEqual({ deleted: 2, errors: 0 })
    const lists = sent.filter((c) => c.type === "list")
    expect(lists).toHaveLength(2)
    expect(lists[1]?.input.ContinuationToken).toBe("tok")
  })

  it("handles multiple prefixes", async () => {
    const { client, sent } = fakeClient([
      { Contents: [{ Key: "projects/1/a.png" }], IsTruncated: false },
      { Contents: [{ Key: "projects/2/a.png" }], IsTruncated: false },
    ])

    const result = await deleteObjectsByPrefixes(["projects/1/", "projects/2/"], client, "bucket")

    expect(result).toEqual({ deleted: 2, errors: 0 })
    expect(sent.filter((c) => c.type === "list")).toHaveLength(2)
  })

  it("is a no-op for an empty prefix list and for prefixes with no objects", async () => {
    const { client: emptyClient, sent: noSent } = fakeClient([])
    expect(await deleteObjectsByPrefixes([], emptyClient, "bucket")).toEqual({
      deleted: 0,
      errors: 0,
    })
    expect(noSent).toHaveLength(0)

    const { client } = fakeClient([{ Contents: [], IsTruncated: false }])
    expect(await deleteObjectsByPrefixes(["projects/9/"], client, "bucket")).toEqual({
      deleted: 0,
      errors: 0,
    })
  })

  it("refuses an empty-string prefix (which would match the whole bucket)", async () => {
    const { client, sent } = fakeClient([{ Contents: [{ Key: "x" }], IsTruncated: false }])
    const result = await deleteObjectsByPrefixes([""], client, "bucket")
    expect(result).toEqual({ deleted: 0, errors: 0 })
    expect(sent).toHaveLength(0)
  })

  it("counts and tolerates per-object delete errors without throwing", async () => {
    const { client } = fakeClient(
      [
        {
          Contents: [{ Key: "projects/1/a.png" }, { Key: "projects/1/b.png" }],
          IsTruncated: false,
        },
      ],
      { "projects/1/b.png": "AccessDenied" },
    )

    const result = await deleteObjectsByPrefixes(["projects/1/"], client, "bucket")
    expect(result).toEqual({ deleted: 1, errors: 1 })
  })
})
