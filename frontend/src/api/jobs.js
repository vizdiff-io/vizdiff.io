import { handleError } from "api/utils"
import { createRequest } from "api/request"

export const createJob = async (state, data) => {
  return createRequest(`/jobs`, state, {
    method: "POST",
    body: data,
  }).then((res) => handleError(res))
}

export const getJobs = async (state) => {
  return createRequest(`/jobs`, state, {
    method: "GET",
  }).then((res) => handleError(res))
}

export const updateJob = async (state, data) => {
  const { id, ...body } = data
  return createRequest(`/jobs/${id}`, state, {
    method: "PUT",
    body,
  }).then((res) => handleError(res))
}

export const deleteJob = async (state, id) => {
  return createRequest(`/jobs/${id}`, state, {
    method: "DELETE",
  }).then((res) => handleError(res))
}
