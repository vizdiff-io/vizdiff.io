import { getUser } from "../authenticate"
import { Database } from "../database"
import { Project } from "../entity/Project"
import { ScreenshotTest } from "../entity/ScreenshotTest"
import { getParamInt } from "../http"
import { log } from "../log"
import { DefaultRequest, DefaultResponse, CreateScreenshotTestRequestBody } from "../types"

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

export async function create(req: DefaultRequest, _res: DefaultResponse): Promise<void> {
  const {
    branches_url: branchesUrl,
    html_url: projectUrl,
    commits_url: commitsUrl,
  } = req.body.repository as CreateScreenshotTestRequestBody

  const commitSha = commitsUrl.split("/").pop()
  const branch = branchesUrl.split("/").pop()
  if (!commitSha || !branch) {
    throw new Error("Invalid request body")
  }
  const status = "pending"

  // get projectId from projectUrl + branch
  const db = await Database()
  const projectTable = db.getRepository(Project)
  const project = await projectTable.findOneBy({ githubRepoUrl: projectUrl })
  if (!project) {
    throw new Error("Project not found")
  }

  const screenshotTest = new ScreenshotTest()
  screenshotTest.projectId = project.id
  screenshotTest.commitSha = commitSha
  screenshotTest.branch = branch
  screenshotTest.status = status

  const screenshotTestTable = db.getRepository(ScreenshotTest)
  await screenshotTestTable.save(screenshotTest)

  log.info(`Created screenshot test for project ${project.id} and commit ${commitSha}`)
}
