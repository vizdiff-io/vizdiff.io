import { getUser } from "../authenticate"
import { Database } from "../database"
import { Project } from "../entity/Project"
import { DefaultRequest, DefaultResponse } from "../types"

export async function create(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  const name = req.body.name as string | undefined
  const githubRepoUrl = req.body.githubRepoUrl as string | undefined

  if (!name) {
    throw new Error("Missing name")
  }
  if (!githubRepoUrl) {
    throw new Error("Missing githubRepoUrl")
  }

  const project = new Project()
  project.name = name
  project.githubRepoUrl = githubRepoUrl
  project.user = Promise.resolve(user)

  const db = await Database()
  const projectTable = db.getRepository(Project)
  await projectTable.save(project)

  res.json(project)
}

export async function remove(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  const id = parseInt((req.params as Record<string, string>).id!)

  if (isNaN(id) || id < 1) {
    throw new Error("Missing id")
  }

  const db = await Database()
  const projectTable = db.getRepository(Project)
  const project = await projectTable.findOneBy({ id, user: { id: user.id } })

  if (!project) {
    throw new Error("Project not found")
  }

  await projectTable.remove(project)

  res.json({ success: true })
}

export async function list(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)

  const db = await Database()
  const projectTable = db.getRepository(Project)
  const projects = await projectTable.findBy({ user: { id: user.id } })

  res.json(projects)
}
