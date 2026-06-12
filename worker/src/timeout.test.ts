import { describe, it, expect, vi } from "vitest"

import { BuildTimeoutError, withTimeout } from "./timeout"

describe("withTimeout", () => {
  it("resolves with the work result when it finishes before the timeout", async () => {
    const onTimeout = vi.fn()
    const result = await withTimeout(Promise.resolve("done"), 1000, onTimeout)
    expect(result).toBe("done")
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it("throws BuildTimeoutError and invokes onTimeout when work exceeds the timeout", async () => {
    const onTimeout = vi.fn()
    // Work that never settles on its own; the timeout must win.
    const hangingWork = new Promise<void>(() => {
      /* never resolves */
    })

    await expect(withTimeout(hangingWork, 10, onTimeout)).rejects.toBeInstanceOf(BuildTimeoutError)
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it("does not let an onTimeout rejection mask the BuildTimeoutError", async () => {
    const onTimeout = vi.fn().mockRejectedValue(new Error("abort failed"))
    const hangingWork = new Promise<void>(() => {
      /* never resolves */
    })

    const error = await withTimeout(hangingWork, 10, onTimeout).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(BuildTimeoutError)
  })
})
