import { createSelector } from "@reduxjs/toolkit"
import Cookies from "universal-cookie"
import { domain } from "api/utils"

const cookies = new Cookies(null, { path: "/" })
const jwt = cookies.get("token")
const selectUser = (state) => state.users

export const authTokenSelector = createSelector(
  selectUser,
  (userState) => userState.currentUser.data?.jwt,
)

export const createRequest = async (endpoint, state, { method, body, headers, contentType }) => {
  let reqDomain = domain()
  let url = `${reqDomain}${endpoint}`
  // const jwt = authTokenSelector(state);
  const opts = {
    method,
    headers: {
      jwt,
      ...headers,
    },
  }
  if (contentType !== "multipart/form-data") {
    opts.headers["Content-Type"] = "application/json"
  }

  if (!!body && opts.headers["Content-Type"] === "application/json") {
    opts.body = JSON.stringify(body)
  } else if (!!body) {
    opts.body = body
  }

  return fetch(url, opts)
}
