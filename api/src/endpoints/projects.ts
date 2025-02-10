import { Project } from "shared"

import { getUser } from "../authenticate"
import { Database } from "../database"
import { getParamInt } from "../http"
import type { DefaultRequest, DefaultResponse } from "../types"

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
  project.user = user
  project.token = generateProjectToken()

  const db = await Database()
  const projectTable = db.getRepository(Project)
  await projectTable.save(project)

  res.json(project)
}

export async function remove(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  const id = getParamInt("id", req)
  if (!id) {
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

export async function get(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  const id = getParamInt("id", req)
  if (!id) {
    throw new Error("Missing id")
  }

  const db = await Database()
  const projectTable = db.getRepository(Project)
  const project = await projectTable.findOneBy({ id, user: { id: user.id } })

  if (!project) {
    throw new Error("Project not found")
  }

  res.json(project)
}

export async function resetToken(req: DefaultRequest, res: DefaultResponse): Promise<void> {
  const user = await getUser(req)
  const id = getParamInt("id", req)
  if (!id) {
    throw new Error("Missing id")
  }

  const db = await Database()
  const projectTable = db.getRepository(Project)
  const project = await projectTable.findOneBy({ id, user: { id: user.id } })

  if (!project) {
    throw new Error("Project not found")
  }

  project.token = generateProjectToken()
  await projectTable.save(project)

  res.json(project)
}

/** Generate a random 12-character hex string to use as a project token. */
function generateProjectToken(): string {
  return [...Array<undefined>(12)].map(() => Math.floor(Math.random() * 16).toString(16)).join("")
}
