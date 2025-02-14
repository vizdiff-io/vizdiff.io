import { ScreenshotTest } from "shared"

import { Database } from "../database"
import { getParamInt } from "../http"
import type { RequestHandler } from "../types"

export const approveOrDeny: RequestHandler = async (req, res) => {
  const { user } = res.locals
  const id = getParamInt("id", req)
  const status = req.params.status as string | undefined

  if (!id) {
    res.status(400).json({ error: "Missing id" })
    return
  }
  if (!status) {
    res.status(400).json({ error: "Missing status" })
    return
  }
  if (status !== "approve" && status !== "deny") {
    res.status(400).json({ error: "Invalid status" })
    return
  }

  const db = await Database()
  const testTable = db.getRepository(ScreenshotTest)
  const test = await testTable
    .createQueryBuilder("test")
    .innerJoinAndSelect("test.project", "project")
    .where("test.id = :id AND project.user = :userId", { id, userId: user.id })
    .getOne()

  if (!test) {
    res.status(404).json({ error: "Test not found" })
    return
  }

  // Update the screenshot test status
  test.status = status === "approve" ? "approved" : "denied"
  await testTable.save(test)

  res.json({ success: true })
}
