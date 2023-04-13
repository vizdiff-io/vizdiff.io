import request from "supertest"

import { Database } from "./database"
import server from "./index"

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

describe("app", () => {
  it("should have a correctly configured test environment", () => {
    expect(process.env.NODE_ENV).toBe("test")
    expect(process.env.PORT).toBe("0")
  })

  it("GET /", async () => {
    const response = await request(server).get("/")
    expect(response.status).toBe(200)
    expect(response.body.uptime).toBeGreaterThan(0)
  })

  afterAll(() => {
    server.close()
    void Database().then(async (db) => await db.destroy())
  })
})
