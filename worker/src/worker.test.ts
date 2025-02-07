import { processTask, shutdown } from "./worker"

describe("worker", () => {
  it("should have a correctly configured test environment", async () => {
    await expect(process.env.NODE_ENV).toBe("test")
  })

  describe("processTask", () => {
    it("should fail to process an unknown task", async () => {
      let error: Error | undefined
      try {
        await processTask("unknown", {})
      } catch (err) {
        error = err as Error
      }
      await expect(error).toBeInstanceOf(Error)
      await expect(error!.message).toBe("Unknown task type: unknown")
    })
  })

  afterAll(() => {
    shutdown()
  })
})
