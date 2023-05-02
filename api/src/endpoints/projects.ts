import { getUser } from "../authenticate"
import { Database } from "../database"
import { Project } from "../entity/Project"
import { requiredJsonBodyString, requiredParamString } from "../http"
import { DefaultRequest, DefaultResponse } from "../types"

export async function create(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const githubOwner = requiredJsonBodyString("github_owner", req)
  const name = requiredJsonBodyString("name", req)
  const user = await getUser(req)
  const db = await Database()
  const projectTable = db.getRepository(Project)

  let project = new Project()
  project.user = Promise.resolve(user)
  project.githubOwner = githubOwner
  project.name = name
  project = await projectTable.save(project)

  res.json({ project })
}

export async function list(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  const db = await Database()

  const projects = await db.manager.findBy(Project, { user: { id: user.id } })
  res.json({ projects })
}

export async function get(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const projectId = parseInt(requiredParamString("projectId", req))
  if (isNaN(projectId)) {
    throw new Error(`Invalid project id`)
  }

  const user = await getUser(req)
  const db = await Database()

  const project = await db.manager.findOneBy(Project, { id: projectId, user: { id: user.id } })
  if (!project) {
    throw new Error(`Project id "${projectId}" not found`)
  }

  res.json({ project })
}

export async function remove(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const projectId = parseInt(requiredParamString("projectId", req))
  if (isNaN(projectId)) {
    throw new Error(`Invalid project id`)
  }

  const user = await getUser(req)
  const db = await Database()

  const project = await db.manager.findOneBy(Project, { id: projectId, user: { id: user.id } })
  if (!project) {
    throw new Error(`Project id "${projectId}" not found`)
  }

  await db.manager.remove(project)
  res.json({ project })
}
