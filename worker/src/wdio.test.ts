import { describe, expect, it } from "vitest"

import { nodeCompatTransformRequest } from "./wdio"

describe("nodeCompatTransformRequest", () => {
  it("removes the Connection and Content-Length headers undici 7 forbids", () => {
    const result = nodeCompatTransformRequest({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Connection: "keep-alive",
        "Content-Length": "123",
        Accept: "application/json",
      },
      body: "{}",
    })
    const headers = new Headers(result.headers)
    expect(headers.has("connection")).toBe(false)
    expect(headers.has("content-length")).toBe(false)
    // Unrelated headers are preserved.
    expect(headers.get("content-type")).toBe("application/json")
    expect(headers.get("accept")).toBe("application/json")
  })

  it("is case-insensitive when removing forbidden headers", () => {
    const result = nodeCompatTransformRequest({
      headers: { CONNECTION: "keep-alive", "content-length": "5" },
    })
    const headers = new Headers(result.headers)
    expect(headers.has("connection")).toBe(false)
    expect(headers.has("content-length")).toBe(false)
  })

  it("preserves other request options", () => {
    const result = nodeCompatTransformRequest({
      method: "POST",
      body: "payload",
      redirect: "follow",
    })
    expect(result.method).toBe("POST")
    expect(result.body).toBe("payload")
    expect(result.redirect).toBe("follow")
  })

  it("does not throw when no headers are present", () => {
    expect(() => nodeCompatTransformRequest({ method: "GET" })).not.toThrow()
  })
})
