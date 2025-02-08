import { handleError } from "api/utils"
import { createRequest } from "api/request"

export const getRepos = async (state, org) => {
  const query = org ? `?org=${org}` : ""
  return createRequest(`/github/repos/${query}`, state, {
    method: "GET",
  }).then((res) => handleError(res))
}

export const getOrgs = async (state) => {
  return createRequest(`/github/orgs`, state, {
    method: "GET",
  }).then((res) => handleError(res))
}
