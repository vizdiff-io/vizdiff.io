import { describe, expect, it, vi } from "vitest"
import type { Browser } from "webdriverio"

import { createBrowserPool } from "./browserPool"

vi.mock("./log", () => ({
  log: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

function fakeBrowser(): Browser {
  return { deleteSession: vi.fn().mockResolvedValue(undefined) } as unknown as Browser
}

describe("createBrowserPool", () => {
  it("creates `size` sessions via the factory", async () => {
    const factory = vi.fn(async () => fakeBrowser())
    const pool = await createBrowserPool(3, factory)
    expect(factory).toHaveBeenCalledTimes(3)
    expect(pool.size).toBe(3)
    expect(pool.browsers).toHaveLength(3)
  })

  it("clamps size to at least 1", async () => {
    const factory = vi.fn(async () => fakeBrowser())
    const pool = await createBrowserPool(0, factory)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(pool.size).toBe(1)
  })

  it("hands out distinct sessions until exhausted, then waits for a release", async () => {
    const pool = await createBrowserPool(2, async () => fakeBrowser())
    const a = await pool.acquire()
    const b = await pool.acquire()
    expect(a).not.toBe(b)

    // Pool exhausted: the next acquire pends until something is released.
    let resolved: Browser | undefined
    const pending = pool.acquire().then((x) => (resolved = x))
    await Promise.resolve()
    expect(resolved).toBeUndefined()

    pool.release(a)
    await pending
    expect(resolved).toBe(a) // the released session is handed straight to the waiter
  })

  it("returns a session to the available set when no waiter is queued", async () => {
    const pool = await createBrowserPool(1, async () => fakeBrowser())
    const a = await pool.acquire()
    pool.release(a)
    const again = await pool.acquire()
    expect(again).toBe(a)
  })

  it("destroyAll closes every session and tolerates an already-closed one", async () => {
    const del0 = vi.fn().mockResolvedValue(undefined)
    const del1 = vi
      .fn()
      .mockRejectedValueOnce(new Error("already gone"))
      .mockResolvedValue(undefined)
    const browsers = [
      { deleteSession: del0 } as unknown as Browser,
      { deleteSession: del1 } as unknown as Browser,
    ]
    let i = 0
    const pool = await createBrowserPool(2, async () => browsers[i++])
    await expect(pool.destroyAll()).resolves.toBeUndefined()
    expect(del0).toHaveBeenCalled()
    expect(del1).toHaveBeenCalled()
  })

  it("tears down already-created sessions if a later one fails to init, then rethrows", async () => {
    const goodDel = vi.fn().mockResolvedValue(undefined)
    const good = { deleteSession: goodDel } as unknown as Browser
    let call = 0
    // call 1 resolves immediately (pushed first by microtask ordering); call 2 throws.
    const factory = vi.fn(async (): Promise<Browser> => {
      call += 1
      if (call === 2) {
        throw new Error("init failed")
      }
      return good
    })
    await expect(createBrowserPool(2, factory)).rejects.toThrow("init failed")
    expect(goodDel).toHaveBeenCalled()
  })
})
