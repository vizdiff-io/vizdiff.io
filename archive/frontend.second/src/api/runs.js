import { handleError } from "api/utils"
import { createRequest } from "api/request"

export const createRun = async (state, data) => {
  return createRequest(`/runs`, state, {
    method: "POST",
    body: data,
  }).then((res) => handleError(res))
}

export const getRuns = async (state) => {
  return createRequest(`/runs`, state, {
    method: "GET",
  }).then((res) => handleError(res))
}

export const updateRun = async (state, data) => {
  const { id, ...body } = data
  return createRequest(`/runs/${id}`, state, {
    method: "PUT",
    body,
  }).then((res) => handleError(res))
}

export const deleteRun = async (state, id) => {
  return createRequest(`/runs/${id}`, state, {
    method: "DELETE",
  }).then((res) => handleError(res))
}
