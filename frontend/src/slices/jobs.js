import { createSlice, createSelector } from "@reduxjs/toolkit"

import {
  getJobs as getJobsAPI,
  createJob as createJobAPI,
  updateJob as updateJobAPI,
  deleteJob as deleteJobAPI,
} from "api/jobs"
import { emptyJob } from "fixtures/jobs"
import {
  getGenericStarted,
  getGenericFailure,
  getGenericSuccess,
  getPayloadSuccess,
  getGenericState,
  handleError,
} from "./sliceUtils"

export const initialJobsState = {
  createJob: getGenericState(),
  updateJob: getGenericState(),
  jobs: getGenericState([]),
  deleteJob: getGenericState(),
}

export const jobsSlice = createSlice({
  name: "jobs",
  initialState: initialJobsState,
  reducers: {
    createJobStarted: getGenericStarted("createJob"),
    createJobSuccess: getGenericSuccess("createJob"),
    createJobFailure: getGenericFailure("createJob"),

    getJobsStarted: getGenericStarted("jobs"),
    getJobsSuccess: getPayloadSuccess("jobs"),
    getJobsFailure: getGenericFailure("jobs"),

    updateJobStarted: getGenericStarted("updateJob"),
    updateJobSuccess: getGenericSuccess("updateJob"),
    updateJobFailure: getGenericFailure("updateJob"),

    deleteJobStarted: getGenericStarted("deleteJob"),
    deleteJobSuccess: getGenericSuccess("deleteJob"),
    deleteJobFailure: getGenericFailure("deleteJob"),
  },
})

export const {
  createJobStarted,
  createJobSuccess,
  createJobFailure,

  getJobsStarted,
  getJobsSuccess,
  getJobsFailure,

  updateJobStarted,
  updateJobSuccess,
  updateJobFailure,

  deleteJobStarted,
  deleteJobSuccess,
  deleteJobFailure,
} = jobsSlice.actions

export default jobsSlice.reducer

export const getJobs = () => async (dispatch, getState) => {
  dispatch(getJobsStarted())
  try {
    const res = await getJobsAPI(getState())
    dispatch(getJobsSuccess(res))
  } catch (err) {
    handleError(err, dispatch, getJobsFailure, "There was an issue retrieving your Jobs")
  }
}

export const createJob = (data) => async (dispatch, getState) => {
  dispatch(createJobStarted())
  try {
    const res = await createJobAPI(getState(), data)
    dispatch(createJobSuccess(res))
    dispatch(getJobs())
    return res
  } catch (err) {
    handleError(err, dispatch, createJobFailure, "There was an issue creating your Job")
  }
}

export const updateJob = (data) => async (dispatch, getState) => {
  dispatch(updateJobStarted())
  try {
    const res = await updateJobAPI(getState(), data)
    dispatch(updateJobSuccess(res))
    dispatch(getJobs())
    return res
  } catch (err) {
    handleError(err, dispatch, updateJobFailure, "There was an issue updating your Job")
  }
}

export const deleteJob = (ids) => async (dispatch, getState) => {
  dispatch(deleteJobStarted())
  try {
    await Promise.all(ids.map((id) => deleteJobAPI(getState(), id)))
    dispatch(deleteJobSuccess())
    dispatch(getJobs())
  } catch (err) {
    handleError(err, dispatch, deleteJobFailure, "There was an issue deleting this Job")
  }
}

// selectors
const selectJobs = (state) => state.jobs || initialJobsState
const selectId = (_, id) => id

export const createJobSelector = createSelector(
  selectJobs,
  (jobsState = {}) => jobsState.createJob || getGenericState(),
)

export const updateJobSelector = createSelector(
  selectJobs,
  (jobsState = {}) => jobsState.updateJob || getGenericState(),
)

export const jobsSelector = createSelector(
  selectJobs,
  (jobsState = {}) => jobsState.jobs || getGenericState(),
)

export const jobsSetSelector = createSelector(jobsSelector, (jobsState) => {
  const jobs = jobsState.data || []
  return new Set(jobs.map((job) => job.githubRepoUrl))
})

export const deleteJobSelector = createSelector(
  selectJobs,
  (jobsState = {}) => jobsState.deleteJob || getGenericState(),
)

export const jobDetailsSelector = createSelector([jobsSelector, selectId], (jobsState, id) => {
  const { data: jobs } = jobsState
  return jobs.find((job) => job.id === id) || emptyJob
})
