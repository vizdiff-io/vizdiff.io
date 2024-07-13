import { handleError } from "api/utils"
import { createRequest } from "api/request"

export const createRun = async (state, data) => {
  return createRequest(`/screenshot-tests`, state, {
    method: "POST",
    body: data,
  }).then((res) => handleError(res))
}

export const getRuns = async (state) => {
  return createRequest(`/screenshot-tests`, state, {
    method: "GET",
  }).then((res) => handleError(res))
}

export const updateRun = async (state, data) => {
  const { id, ...body } = data
  return createRequest(`/screenshot-tests/${id}`, state, {
    method: "PUT",
    body,
  }).then((res) => handleError(res))
}

export const deleteRun = async (state, id) => {
  return createRequest(`/screenshot-tests/${id}`, state, {
    method: "DELETE",
  }).then((res) => handleError(res))
}
