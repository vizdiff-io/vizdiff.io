import { expect, describe, it, afterAll } from "vitest"

import { processTask, shutdown } from "./worker"

describe("worker", () => {
  it("should have a correctly configured test environment", () => {
    expect(process.env.NODE_ENV).toBe("test")
  })

  describe("processTask", () => {
    it("should fail to process an unknown task", async () => {
      let error: Error | undefined
      try {
        await processTask("unknown", {})
      } catch (err) {
        error = err as Error
      }
      expect(error).toBeInstanceOf(Error)
      expect(error!.message).toBe("Unknown task type: unknown")
    })
  })

  afterAll(() => {
    shutdown()
  })
})
