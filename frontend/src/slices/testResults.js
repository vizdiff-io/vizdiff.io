import { createSlice, createSelector } from "@reduxjs/toolkit"

import {
  getTestResults as getTestResultsAPI,
  createTestResult as createTestResultAPI,
  updateTestResult as updateTestResultAPI,
  deleteTestResult as deleteTestResultAPI,
} from "api/testResults"
import { emptyTestResult } from "fixtures/testResults"
import {
  getGenericStarted,
  getGenericFailure,
  getGenericSuccess,
  getPayloadSuccess,
  getGenericState,
  handleError,
  ensureData,
} from "./sliceUtils"

export const initialTestResultsState = {
  createTestResult: getGenericState(),
  updateTestResult: getGenericState(),
  testResults: getGenericState([]),
  deleteTestResult: getGenericState(),
}

export const testResultsSlice = createSlice({
  name: "testResults",
  initialState: initialTestResultsState,
  reducers: {
    createTestResultStarted: getGenericStarted("createTestResult"),
    createTestResultSuccess: getGenericSuccess("createTestResult"),
    createTestResultFailure: getGenericFailure("createTestResult"),

    getTestResultsStarted: getGenericStarted("testResults"),
    getTestResultsSuccess: getPayloadSuccess("testResults"),
    getTestResultsFailure: getGenericFailure("testResults"),

    updateTestResultStarted: getGenericStarted("updateTestResult"),
    updateTestResultSuccess: getGenericSuccess("updateTestResult"),
    updateTestResultFailure: getGenericFailure("updateTestResult"),

    deleteTestResultStarted: getGenericStarted("deleteTestResult"),
    deleteTestResultSuccess: getGenericSuccess("deleteTestResult"),
    deleteTestResultFailure: getGenericFailure("deleteTestResult"),
  },
})

export const {
  createTestResultStarted,
  createTestResultSuccess,
  createTestResultFailure,

  getTestResultsStarted,
  getTestResultsSuccess,
  getTestResultsFailure,

  updateTestResultStarted,
  updateTestResultSuccess,
  updateTestResultFailure,

  deleteTestResultStarted,
  deleteTestResultSuccess,
  deleteTestResultFailure,
} = testResultsSlice.actions

export default testResultsSlice.reducer

export const getTestResults = (id) => async (dispatch, getState) => {
  dispatch(getTestResultsStarted())
  try {
    const res = await getTestResultsAPI(getState(), id)
    dispatch(getTestResultsSuccess(res))
  } catch (err) {
    handleError(
      err,
      dispatch,
      getTestResultsFailure,
      "There was an issue retrieving your TestResults",
    )
  }
}

export const createTestResult = (data) => async (dispatch, getState) => {
  dispatch(createTestResultStarted())
  try {
    const res = await createTestResultAPI(getState(), data)
    dispatch(createTestResultSuccess(res))
    dispatch(getTestResults())
    return res
  } catch (err) {
    handleError(
      err,
      dispatch,
      createTestResultFailure,
      "There was an issue creating your TestResult",
    )
  }
}

export const updateTestResult = (data) => async (dispatch, getState) => {
  dispatch(updateTestResultStarted())
  try {
    const res = await updateTestResultAPI(getState(), data)
    dispatch(updateTestResultSuccess(res))
    dispatch(getTestResults())
    return res
  } catch (err) {
    handleError(
      err,
      dispatch,
      updateTestResultFailure,
      "There was an issue updating your TestResult",
    )
  }
}

export const deleteTestResult = (ids) => async (dispatch, getState) => {
  dispatch(deleteTestResultStarted())
  try {
    await Promise.all(ids.map((id) => deleteTestResultAPI(getState(), id)))
    dispatch(deleteTestResultSuccess())
    dispatch(getTestResults())
  } catch (err) {
    handleError(
      err,
      dispatch,
      deleteTestResultFailure,
      "There was an issue deleting this TestResult",
    )
  }
}

// selectors
const selectTestResults = (state) => state.testResults || initialTestResultsState
const selectId = (_, id) => id

export const createTestResultSelector = createSelector(
  selectTestResults,
  (testResultsState = {}) => testResultsState.createTestResult || getGenericState(),
)

export const updateTestResultSelector = createSelector(
  selectTestResults,
  (testResultsState = {}) => testResultsState.updateTestResult || getGenericState(),
)

export const testResultsSelector = createSelector(selectTestResults, (testResultsState = {}) =>
  ensureData(testResultsState, "testResults", []),
)

export const testResultsSetSelector = createSelector(testResultsSelector, (testResultsState) => {
  const testResults = testResultsState.data || []
  return new Set(testResults.map((testResult) => testResult.githubRepoUrl))
})

export const deleteTestResultSelector = createSelector(
  selectTestResults,
  (testResultsState = {}) => testResultsState.deleteTestResult || getGenericState(),
)

export const testResultDetailsSelector = createSelector(
  [testResultsSelector, selectId],
  (testResultsState, id) => {
    const { data: testResults } = testResultsState
    return testResults.find((testResult) => `${testResult.id}` === id) || emptyTestResult
  },
)
