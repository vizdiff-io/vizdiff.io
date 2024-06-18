import { handleError } from "api/utils"
import { createRequest } from "api/request"

export const getRepos = async (state) => {
  return createRequest(`/github/repos`, state, {
    method: "GET",
  }).then((res) => handleError(res))
}
