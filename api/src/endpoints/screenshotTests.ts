import { getUser } from "../authenticate"
import { Database } from "../database"
import { Project } from "../entity/Project"
import { ScreenshotTest } from "../entity/ScreenshotTest"
import { getParamInt } from "../http"
import { DefaultRequest, DefaultResponse } from "../types"

export async function list(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  const db = await Database()

  const projectTable = db.getRepository(Project)
  const projects = await projectTable.findBy({ user: { id: user.id } })
  const screenshotTestTable = db.getRepository(ScreenshotTest)
  const screenshotTests = await Promise.all(
    projects.map((project) => screenshotTestTable.findBy({ project: { id: project.id } })),
  )
  const screenshotTestsFlat = screenshotTests.flat()
  res.json(screenshotTestsFlat)
}

export async function get(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  const id = getParamInt("id", req)

  const db = await Database()
  const screenshotTestTable = db.getRepository(ScreenshotTest)
  const screenshotTest = await screenshotTestTable.findOneBy({
    id,
    project: { user: { id: user.id } },
  })

  if (!screenshotTest) {
    throw new Error("ScreenshotTest not found")
  }

  res.json(screenshotTest)
}
