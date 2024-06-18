import { createSlice, createSelector } from "@reduxjs/toolkit"

import { getRepos as getReposAPI } from "api/github"

import {
  getGenericStarted,
  getGenericFailure,
  getPayloadSuccess,
  getGenericState,
  handleError,
} from "./sliceUtils"

export const initialGithubState = {
  repos: getGenericState([]),
}

export const githubSlice = createSlice({
  name: "github",
  initialState: initialGithubState,
  reducers: {
    getReposStarted: getGenericStarted("repos"),
    getReposSuccess: getPayloadSuccess("repos"),
    getReposFailure: getGenericFailure("repos"),
  },
})

export const { getReposStarted, getReposSuccess, getReposFailure } = githubSlice.actions

export default githubSlice.reducer

export const getRepos = () => async (dispatch, getState) => {
  dispatch(getReposStarted())
  try {
    const res = await getReposAPI(getState())
    dispatch(getReposSuccess(res))
  } catch (err) {
    handleError(err, dispatch, getReposFailure, "There was an issue retrieving your Repos")
  }
}

// selectors
const selectGithub = (state) => state.github || initialGithubState

export const reposSelector = createSelector(
  selectGithub,
  (githubState = {}) => githubState.repos || getGenericState(),
)
