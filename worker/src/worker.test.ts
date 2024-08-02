import { processTask, shutdown } from "./worker"

describe("worker", () => {
  it("should have a correctly configured test environment", () => {
    expect(process.env.NODE_ENV).toBe("test")
  })

  describe("processTask", () => {
    it("should fail to process an unknown task", async () => {
      expect(() => processTask("unknown", {})).toThrow()
    })
  })

  afterAll(() => {
    shutdown()
  })
})
