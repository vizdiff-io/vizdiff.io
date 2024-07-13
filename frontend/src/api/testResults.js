import { handleError } from "api/utils"
import { createRequest } from "api/request"

export const createTestResult = async (state, data) => {
  return createRequest(`/test-results`, state, {
    method: "POST",
    body: data,
  }).then((res) => handleError(res))
}

export const getTestResults = async (state, id) => {
  return createRequest(`/test-results/screenshot-tests/${id}`, state, {
    method: "GET",
  }).then((res) => handleError(res))
}

export const updateTestResult = async (state, data) => {
  const { id, ...body } = data
  return createRequest(`/test-results/${id}`, state, {
    method: "PUT",
    body,
  }).then((res) => handleError(res))
}

export const deleteTestResult = async (state, id) => {
  return createRequest(`/test-results/${id}`, state, {
    method: "DELETE",
  }).then((res) => handleError(res))
}
