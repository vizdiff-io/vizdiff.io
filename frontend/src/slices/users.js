import { createSlice, createSelector } from '@reduxjs/toolkit';
import { toast } from 'react-toastify';
import { find, propEq } from 'ramda';

import {
  signin as signinAPI,
  signup as signupAPI,
  getUser as getUserAPI,
  getUsers as getUsersAPI,
  updatePassword as updatePasswordAPI,
  sendPasswordReset as sendPasswordResetAPI,
  createNewPassword as createNewPasswordAPI,
  updateUser as updateUserAPI,
} from 'api/users';
import { emptyUserData } from 'fixtures/user';
import {
  getGenericStarted,
  getGenericFailure,
  getGenericSuccess,
  getPayloadSuccess,
  getGenericState,
  handleError,
} from './sliceUtils';

export const usersInitialState = {
  signup: getGenericState(),
  signin: getGenericState(),
  currentUser: getGenericState(emptyUserData),
  updateUser: getGenericState(),
  getUser: getGenericState(),
  getUsers: getGenericState(),
  updatePassword: getGenericState(),
  sendPasswordReset: getGenericState(),
  createNewPassword: getGenericState(),
};

export const userSlice = createSlice({
  name: 'user',
  initialState: usersInitialState,
  reducers: {
    signupStarted: getGenericStarted('signup'),
    signupSuccess: getPayloadSuccess('signup', 'currentUser'),
    signupFailure: getGenericFailure('signup'),

    logout: (state) => {
      state.currentUser = getGenericState(emptyUserData);
    },

    getUserStarted: getGenericStarted('getUser'),
    getUserSuccess: (state, action) => {
      state.getUser.loading = false;
      state.getUser.error = '';
      state.currentUser = {
        ...state.currentUser,
        data: {
          ...action.payload,
          auth_token: state.currentUser.data.auth_token,
        },
      };
    },
    getUserFailure: getGenericFailure('getUser'),

    getUsersStarted: getGenericStarted('getUsers'),
    getUsersSuccess: getPayloadSuccess('getUsers'),
    getUsersFailure: getGenericFailure('getUsers'),

    updateUserStarted: getGenericStarted('updateUser'),
    updateUserSuccess: getPayloadSuccess('updateUser'),
    updateUserFailure: getGenericFailure('updateUser'),

    addCreatorsStarted: getGenericStarted('addCreators'),
    addCreatorsSuccess: getGenericSuccess('addCreators'),
    addCreatorsFailure: getGenericFailure('addCreators'),

    addCreatorsBulkStarted: getGenericStarted('addCreatorsBulk'),
    addCreatorsBulkSuccess: getGenericSuccess('addCreatorsBulk'),
    addCreatorsBulkFailure: getGenericFailure('addCreatorsBulk'),

    getCreatorsStarted: getGenericStarted('creators'),
    getCreatorsSuccess: getPayloadSuccess('creators'),
    getCreatorsFailure: getGenericFailure('creators'),

    signinStarted: getGenericStarted('signin'),
    signinSuccess: getPayloadSuccess('signin', 'currentUser'),
    signinFailure: getGenericFailure('signin'),

    updateCreatorStarted: getGenericStarted('updateCreator'),
    updateCreatorSuccess: getPayloadSuccess('updateCreator'),
    updateCreatorFailure: getGenericFailure('updateCreator'),

    updatePasswordStarted: getGenericStarted('updatePassword'),
    updatePasswordSuccess: getPayloadSuccess('updatePassword'),
    updatePasswordFailure: getGenericFailure('updatePassword'),

    updateBankDetailsStarted: getGenericStarted('updateBankDetails'),
    updateBankDetailsSuccess: getPayloadSuccess('updateBankDetails'),
    updateBankDetailsFailure: getGenericFailure('updateBankDetails'),

    sendPasswordResetStarted: getGenericStarted('sendPasswordReset'),
    sendPasswordResetSuccess: getGenericSuccess('sendPasswordReset'),
    sendPasswordResetFailure: getGenericFailure('sendPasswordReset'),

    createNewPasswordStarted: getGenericStarted('createNewPassword'),
    createNewPasswordSuccess: getGenericSuccess('createNewPassword'),
    createNewPasswordFailure: getGenericFailure('createNewPassword'),

    getMembersStarted: getGenericStarted('admins'),
    getMembersSuccess: getPayloadSuccess('admins'),
    getMembersFailure: getGenericFailure('admins'),

    inviteMemberStarted: getGenericStarted('inviteMember'),
    inviteMemberSuccess: getPayloadSuccess('inviteMember'),
    inviteMemberFailure: getGenericFailure('inviteMember'),

    deleteMemberStarted: getGenericStarted('deleteMember'),
    deleteMemberSuccess: getPayloadSuccess('deleteMember'),
    deleteMemberFailure: getGenericFailure('deleteMember'),
  },
});

export const {
  signupStarted,
  signupSuccess,
  signupFailure,

  logout,

  getUserStarted,
  getUserSuccess,
  getUserFailure,

  getUsersStarted,
  getUsersSuccess,
  getUsersFailure,

  updateUserStarted,
  updateUserSuccess,
  updateUserFailure,

  updatePasswordStarted,
  updatePasswordSuccess,
  updatePasswordFailure,

  signinStarted,
  signinSuccess,
  signinFailure,

  addCreatorsStarted,
  addCreatorsSuccess,
  addCreatorsFailure,

  addCreatorsBulkStarted,
  addCreatorsBulkSuccess,
  addCreatorsBulkFailure,

  getCreatorsStarted,
  getCreatorsSuccess,
  getCreatorsFailure,

  updateCreatorStarted,
  updateCreatorSuccess,
  updateCreatorFailure,

  updateBankDetailsStarted,
  updateBankDetailsSuccess,
  updateBankDetailsFailure,

  sendPasswordResetStarted,
  sendPasswordResetSuccess,
  sendPasswordResetFailure,

  createNewPasswordStarted,
  createNewPasswordSuccess,
  createNewPasswordFailure,

  getMembersStarted,
  getMembersSuccess,
  getMembersFailure,

  inviteMemberStarted,
  inviteMemberSuccess,
  inviteMemberFailure,

  deleteMemberStarted,
  deleteMemberSuccess,
  deleteMemberFailure,
} = userSlice.actions;

export default userSlice.reducer;

export const signup = (data, callback) => async (dispatch, getState) => {
  dispatch(signupStarted());
  try {
    const res = await signupAPI(getState(), data);
    dispatch(signupSuccess(res));
    !!callback && callback();
  } catch (err) {
    handleError(err, dispatch, signupFailure, 'There was an issue signing up');
  }
};

export const getUser = () => async (dispatch, getState) => {
  const jwt = authTokenSelector(getState());
  if (!jwt) return;

  dispatch(getUserStarted());

  try {
    const res = await getUserAPI(getState());
    dispatch(getUserSuccess(res));
    return res;
  } catch (err) {
    handleError(
      err,
      dispatch,
      getUserFailure,
      'There was an issue refreshing your user data'
    );
  }
};

export const getUsers = () => async (dispatch, getState) => {
  dispatch(getUsersStarted());
  try {
    const res = await getUsersAPI(getState());
    dispatch(getUsersSuccess(res));
  } catch (err) {
    handleError(
      err,
      dispatch,
      getUsersFailure,
      'There was an issue getting your users'
    );
  }
};

export const signin = (data, callback) => async (dispatch, getState) => {
  dispatch(signinStarted());
  try {
    const res = await signinAPI(getState(), data);
    dispatch(signinSuccess(res));

    !!callback && callback();
  } catch (err) {
    handleError(err, dispatch, signinFailure, 'There was an issue signing in');
  }
};

export const updatePassword = (data) => async (dispatch, getState) => {
  dispatch(updatePasswordStarted());
  try {
    const res = await updatePasswordAPI(getState(), data);
    dispatch(updatePasswordSuccess(res));
    toast.success(`Password has been updated.`);
    return true;
  } catch (err) {
    handleError(
      err,
      dispatch,
      updatePasswordFailure,
      'There was an issue updating your password'
    );
    return false;
  }
};

export const sendPasswordReset = (data) => async (dispatch, getState) => {
  dispatch(sendPasswordResetStarted());
  try {
    const res = await sendPasswordResetAPI(getState(), data);
    dispatch(sendPasswordResetSuccess(res));
    toast.success('Request has been sent, check your email!');
  } catch (err) {
    handleError(
      err,
      dispatch,
      sendPasswordResetFailure,
      'There was an issue sending a password reset email'
    );
  }
};

export const createNewPassword = (data) => async (dispatch, getState) => {
  dispatch(createNewPasswordStarted());
  try {
    const res = await createNewPasswordAPI(getState(), data);
    dispatch(createNewPasswordSuccess(res));
  } catch (err) {
    handleError(
      err,
      dispatch,
      sendPasswordResetFailure,
      'There was an issue creating a new passsword for your account'
    );
  }
};

export const updateUser = (data) => async (dispatch, getState) => {
  dispatch(updateUserStarted());
  try {
    const res = await updateUserAPI(getState(), data);
    dispatch(updateUserSuccess(res));
    return true;
  } catch (err) {
    handleError(
      err,
      dispatch,
      updateUserFailure,
      'There was an issue updating this user'
    );
  }
};

// selectors
const selectUsers = (state) => state.users;
const selectId = (_, id) => id;

export const currentUserSelector = createSelector(
  selectUsers,
  (userState = {}) => userState.currentUser || getGenericState(emptyUserData)
);

export const usersSelector = createSelector(
  selectUsers,
  (userState) => userState?.getUsers || getGenericState([])
);

export const userDetailsSelector = createSelector(
  [usersSelector, selectId],
  (userState, id) => {
    const { data: users = [] } = userState;
    return users.find((user) => user.id == id) || emptyUserData;
  }
);

export const signupStateSelector = createSelector(
  selectUsers,
  (userState) => userState?.signup || getGenericState()
);

export const signinStateSelector = createSelector(
  selectUsers,
  (userState) => userState?.signin || getGenericState()
);

export const authTokenSelector = createSelector(
  selectUsers,
  (userState) => userState?.currentUser.data?.auth_token || getGenericState()
);

export const updatePasswordSelector = createSelector(
  selectUsers,
  (userState) => userState?.updatePassword || getGenericState()
);

export const sendPasswordResetStateSelector = createSelector(
  selectUsers,
  (userState) => userState?.sendPasswordReset || getGenericState()
);

export const createNewPasswordStateSelector = createSelector(
  selectUsers,
  (userState) => userState?.createNewPassword || getGenericState()
);
