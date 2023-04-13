process.env.PORT = "0"

import server from "./index"
import request from "supertest"

describe("app", () => {
  it("should return a 200 status code", async () => {
    const response = await request(server).get("/")
    expect(response.status).toBe(200)
  })

  afterAll(() => {
    server.close()
  })
})
