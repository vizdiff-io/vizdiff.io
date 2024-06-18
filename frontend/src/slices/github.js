import { createSlice, createSelector } from "@reduxjs/toolkit"

import { getRepos as getReposAPI, getOrgs as getOrgsAPI } from "api/github"

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

    getOrgsStarted: getGenericStarted("orgs"),
    getOrgsSuccess: getPayloadSuccess("orgs"),
    getOrgsFailure: getGenericFailure("orgs"),
  },
})

export const {
  getReposStarted,
  getReposSuccess,
  getReposFailure,
  getOrgsStarted,
  getOrgsSuccess,
  getOrgsFailure,
} = githubSlice.actions

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

export const getOrgs = () => async (dispatch, getState) => {
  dispatch(getOrgsStarted())
  try {
    const res = await getOrgsAPI(getState())
    dispatch(getOrgsSuccess(res))
  } catch (err) {
    handleError(err, dispatch, getOrgsFailure, "There was an issue retrieving your Orgs")
  }
}

// selectors
const selectGithub = (state) => state.github || initialGithubState

export const reposSelector = createSelector(
  selectGithub,
  (githubState = {}) => githubState.repos || getGenericState(),
)

export const orgsSelector = createSelector(
  selectGithub,
  (githubState = {}) => githubState.orgs || getGenericState(),
)
