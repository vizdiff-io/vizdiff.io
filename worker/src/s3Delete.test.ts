import { describe, expect, it, vi } from "vitest"

import { deleteObjectsByPrefixes } from "./s3"

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

function fakeClient(
  listResponses: Array<{
    Contents?: { Key: string }[]
    IsTruncated?: boolean
    NextContinuationToken?: string
  }>,
) {
  const sent: FakeCommand[] = []
  let listIdx = 0
  const send = vi.fn((command: FakeCommand) => {
    sent.push(command)
    if (command.type === "list") {
      return Promise.resolve(listResponses[listIdx++] ?? { Contents: [] })
    }
    return Promise.resolve({ Errors: [] })
  })
  return { client: { send } as unknown as Parameters<typeof deleteObjectsByPrefixes>[1], sent }
}

describe("worker deleteObjectsByPrefixes", () => {
  it("lists and batch-deletes objects under a build prefix", async () => {
    const { client, sent } = fakeClient([
      {
        Contents: [
          { Key: "projects/1/screenshots/abc/s.png" },
          { Key: "projects/1/screenshots/abc/s-diff.png" },
        ],
        IsTruncated: false,
      },
    ])

    const result = await deleteObjectsByPrefixes(["projects/1/screenshots/abc/"], client, "bucket")

    expect(result).toEqual({ deleted: 2, errors: 0 })
    expect(sent.find((c) => c.type === "list")?.input.Prefix).toBe("projects/1/screenshots/abc/")
  })

  it("refuses an empty prefix", async () => {
    const { client, sent } = fakeClient([{ Contents: [{ Key: "x" }], IsTruncated: false }])
    const result = await deleteObjectsByPrefixes([""], client, "bucket")
    expect(result).toEqual({ deleted: 0, errors: 0 })
    expect(sent).toHaveLength(0)
  })
})
