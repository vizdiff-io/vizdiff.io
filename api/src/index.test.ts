import request from "supertest"
import { expect, describe, it, afterAll } from "vitest"

import { Database } from "./database"
import server from "./index"

describe("app", () => {
  it("should have a correctly configured test environment", () => {
    expect(process.env.NODE_ENV).toBe("test")
    expect(process.env.PORT).toBe("0")
  })

  it("GET /api", async () => {
    const response = await request(server).get("/api")
    expect(response.status).toBe(200)
    expect(response.body.uptime).toBeGreaterThan(0)
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })

    try {
      const db = await Database()
      if (db.isInitialized) {
        await db.destroy()
      }
    } catch (err) {
      // Do nothing
      void err
    }
  })
})
