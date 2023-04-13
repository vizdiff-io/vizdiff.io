import "reflect-metadata"
import express from "express"
import { auth } from "./endpoints/auth"
import { user } from "./endpoints/user"

const app = express()
const port = process.env.PORT || 3001

auth(app)
user(app)

app.get("/", (_req, res) => {
  res.send("Hello, World!")
})

const server = app.listen(port, () => {
  const address = server.address()
  if (!address) {
    throw new Error(`Server failed to bind to port ${port}`)
  }
  const portStr = typeof address === "string" ? address : address.port
  console.log(`Server is running at http://127.0.0.1:${portStr}`)
})

export default server
