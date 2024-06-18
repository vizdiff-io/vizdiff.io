import { createSlice, createSelector } from '@reduxjs/toolkit';

import {
  getProjects as getProjectsAPI,
  createProject as createProjectAPI,
  updateProject as updateProjectAPI,
  deleteProject as deleteProjectAPI,
} from 'api/projects';
import { emptyProject } from 'fixtures/projects';
import {
  getGenericStarted,
  getGenericFailure,
  getGenericSuccess,
  getPayloadSuccess,
  getGenericState,
  handleError,
} from './sliceUtils';

export const initialProjectsState = {
  createProject: getGenericState(),
  updateProject: getGenericState(),
  projects: getGenericState([]),
  deleteProject: getGenericState(),
};

export const projectsSlice = createSlice({
  name: 'projects',
  initialState: initialProjectsState,
  reducers: {
    createProjectStarted: getGenericStarted('createProject'),
    createProjectSuccess: getGenericSuccess('createProject'),
    createProjectFailure: getGenericFailure('createProject'),

    getProjectsStarted: getGenericStarted('projects'),
    getProjectsSuccess: getPayloadSuccess('projects'),
    getProjectsFailure: getGenericFailure('projects'),

    updateProjectStarted: getGenericStarted('updateProject'),
    updateProjectSuccess: getGenericSuccess('updateProject'),
    updateProjectFailure: getGenericFailure('updateProject'),

    deleteProjectStarted: getGenericStarted('deleteProject'),
    deleteProjectSuccess: getGenericSuccess('deleteProject'),
    deleteProjectFailure: getGenericFailure('deleteProject'),
  },
});

export const {
  createProjectStarted,
  createProjectSuccess,
  createProjectFailure,

  getProjectsStarted,
  getProjectsSuccess,
  getProjectsFailure,

  updateProjectStarted,
  updateProjectSuccess,
  updateProjectFailure,

  deleteProjectStarted,
  deleteProjectSuccess,
  deleteProjectFailure,
} = projectsSlice.actions;

export default projectsSlice.reducer;

export const getProjects = () => async (dispatch, getState) => {
  dispatch(getProjectsStarted());
  try {
    const res = await getProjectsAPI(getState());
    dispatch(getProjectsSuccess(res));
  } catch (err) {
    handleError(
      err,
      dispatch,
      getProjectsFailure,
      'There was an issue retrieving your Projects'
    );
  }
};

export const createProject = (data) => async (dispatch, getState) => {
  dispatch(createProjectStarted());
  try {
    const res = await createProjectAPI(getState(), data);
    dispatch(createProjectSuccess(res));
    dispatch(getProjects());
    return res;
  } catch (err) {
    handleError(
      err,
      dispatch,
      createProjectFailure,
      'There was an issue creating your Agent/ Manager'
    );
  }
};

export const updateProject = (data) => async (dispatch, getState) => {
  dispatch(updateProjectStarted());
  try {
    const res = await updateProjectAPI(getState(), data);
    dispatch(updateProjectSuccess(res));
    dispatch(getProjects());
    return res;
  } catch (err) {
    handleError(
      err,
      dispatch,
      updateProjectFailure,
      'There was an issue updating your Agent/ Manager'
    );
  }
};

export const deleteProject = (ids) => async (dispatch, getState) => {
  dispatch(deleteProjectStarted());
  try {
    await Promise.all(ids.map((id) => deleteProjectAPI(getState(), id)));
    dispatch(deleteProjectSuccess());
    dispatch(getProjects());
  } catch (err) {
    handleError(
      err,
      dispatch,
      deleteProjectFailure,
      'There was an issue deleting this Agent/ Manager'
    );
  }
};

// selectors
const selectProjects = (state) => state.projects || initialProjectsState;
const selectId = (_, id) => id;

export const createProjectSelector = createSelector(
  selectProjects,
  (projectsState = {}) => projectsState.createProject || getGenericState()
);

export const updateProjectSelector = createSelector(
  selectProjects,
  (projectsState = {}) => projectsState.updateProject || getGenericState()
);

export const projectsSelector = createSelector(
  selectProjects,
  (projectsState = {}) => projectsState.projects || getGenericState()
);

export const deleteProjectSelector = createSelector(
  selectProjects,
  (projectsState = {}) => projectsState.deleteProject || getGenericState()
);

export const projectDetailsSelector = createSelector(
  [projectsSelector, selectId],
  (projectsState, id) => {
    const { data: projects } = projectsState;
    return projects.find((project) => project.id === id) || emptyProject;
  }
);
