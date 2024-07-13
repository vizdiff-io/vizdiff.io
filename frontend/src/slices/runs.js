import { createSlice, createSelector } from "@reduxjs/toolkit"

import {
  getRuns as getRunsAPI,
  createRun as createRunAPI,
  updateRun as updateRunAPI,
  deleteRun as deleteRunAPI,
} from "api/runs"
import { emptyRun } from "fixtures/runs"
import {
  getGenericStarted,
  getGenericFailure,
  getGenericSuccess,
  getPayloadSuccess,
  getGenericState,
  handleError,
  ensureData,
} from "./sliceUtils"

export const initialRunsState = {
  createRun: getGenericState(),
  updateRun: getGenericState(),
  runs: getGenericState([]),
  deleteRun: getGenericState(),
}

export const runsSlice = createSlice({
  name: "runs",
  initialState: initialRunsState,
  reducers: {
    createRunStarted: getGenericStarted("createRun"),
    createRunSuccess: getGenericSuccess("createRun"),
    createRunFailure: getGenericFailure("createRun"),

    getRunsStarted: getGenericStarted("runs"),
    getRunsSuccess: getPayloadSuccess("runs"),
    getRunsFailure: getGenericFailure("runs"),

    updateRunStarted: getGenericStarted("updateRun"),
    updateRunSuccess: getGenericSuccess("updateRun"),
    updateRunFailure: getGenericFailure("updateRun"),

    deleteRunStarted: getGenericStarted("deleteRun"),
    deleteRunSuccess: getGenericSuccess("deleteRun"),
    deleteRunFailure: getGenericFailure("deleteRun"),
  },
})

export const {
  createRunStarted,
  createRunSuccess,
  createRunFailure,

  getRunsStarted,
  getRunsSuccess,
  getRunsFailure,

  updateRunStarted,
  updateRunSuccess,
  updateRunFailure,

  deleteRunStarted,
  deleteRunSuccess,
  deleteRunFailure,
} = runsSlice.actions

export default runsSlice.reducer

export const getRuns = () => async (dispatch, getState) => {
  dispatch(getRunsStarted())
  try {
    const res = await getRunsAPI(getState())
    dispatch(getRunsSuccess(res))
  } catch (err) {
    handleError(err, dispatch, getRunsFailure, "There was an issue retrieving your Runs")
  }
}

export const createRun = (data) => async (dispatch, getState) => {
  dispatch(createRunStarted())
  try {
    const res = await createRunAPI(getState(), data)
    dispatch(createRunSuccess(res))
    dispatch(getRuns())
    return res
  } catch (err) {
    handleError(err, dispatch, createRunFailure, "There was an issue creating your Run")
  }
}

export const updateRun = (data) => async (dispatch, getState) => {
  dispatch(updateRunStarted())
  try {
    const res = await updateRunAPI(getState(), data)
    dispatch(updateRunSuccess(res))
    dispatch(getRuns())
    return res
  } catch (err) {
    handleError(err, dispatch, updateRunFailure, "There was an issue updating your Run")
  }
}

export const deleteRun = (ids) => async (dispatch, getState) => {
  dispatch(deleteRunStarted())
  try {
    await Promise.all(ids.map((id) => deleteRunAPI(getState(), id)))
    dispatch(deleteRunSuccess())
    dispatch(getRuns())
  } catch (err) {
    handleError(err, dispatch, deleteRunFailure, "There was an issue deleting this Run")
  }
}

// selectors
const selectRuns = (state) => state.runs || initialRunsState
const selectId = (_, id) => id

export const createRunSelector = createSelector(
  selectRuns,
  (runsState = {}) => runsState.createRun || getGenericState(),
)

export const updateRunSelector = createSelector(
  selectRuns,
  (runsState = {}) => runsState.updateRun || getGenericState(),
)

export const runsSelector = createSelector(selectRuns, (runsState = {}) =>
  ensureData(runsState, "runs", []),
)

export const runsSetSelector = createSelector(runsSelector, (runsState) => {
  const runs = runsState.data || []
  return new Set(runs.map((run) => run.githubRepoUrl))
})

export const deleteRunSelector = createSelector(
  selectRuns,
  (runsState = {}) => runsState.deleteRun || getGenericState(),
)

export const runDetailsSelector = createSelector([runsSelector, selectId], (runsState, id) => {
  const { data: runs } = runsState
  return runs.find((run) => `${run.id}` === id) || emptyRun
})
