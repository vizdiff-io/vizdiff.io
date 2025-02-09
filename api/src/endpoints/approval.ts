import { ScreenshotTest } from "shared"

import { getUser } from "../authenticate"
import { Database } from "../database"
import { getParamInt, getParamString } from "../http"
import type { DefaultRequest, DefaultResponse } from "../types"

export async function approveOrDeny(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  const screenshotTestId = getParamInt("id", req)
  if (!screenshotTestId) {
    throw new Error("Missing screenshot test id")
  }
  const status = getParamString("status", req)
  if (status !== "approved" && status !== "denied") {
    throw new Error("Missing or invalid status")
  }

  const db = await Database()
  const screenshotTestRepo = db.getRepository(ScreenshotTest)
  const screenshotTest = await screenshotTestRepo.findOneBy({ id: screenshotTestId })
  if (!screenshotTest) {
    throw new Error(`Screenshot test ${screenshotTestId} not found`)
  }

  const project = await screenshotTest.project

  // TASK(https://github.com/mvi-llc/vizdiff.io/issues/9): Fall back to asking GitHub if the user
  // (on GitHub) is a collaborator on the repo
  if (project.user.id !== user.id) {
    throw new Error("Access denied")
  }

  // Update the screenshot test status
  screenshotTest.status = status
  await screenshotTestRepo.save(screenshotTest)

  res.json({ success: true })
}
