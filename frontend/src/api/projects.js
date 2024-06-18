import { handleError } from "api/utils"
import { createRequest } from "api/request"

export const createProject = async (state, data) => {
  return createRequest(`/projects`, state, {
    method: "POST",
    body: data,
  }).then((res) => handleError(res))
}

export const getProjects = async (state) => {
  return createRequest(`/projects`, state, {
    method: "GET",
  }).then((res) => handleError(res))
}

export const updateProject = async (state, data) => {
  const { id, ...body } = data
  return createRequest(`/projects/${id}`, state, {
    method: "PUT",
    body,
  }).then((res) => handleError(res))
}

export const deleteProject = async (state, id) => {
  return createRequest(`/projects/${id}`, state, {
    method: "DELETE",
  }).then((res) => handleError(res))
}
