import { createParams, handleError } from 'api/utils';
import { createRequest } from 'api/request';

export const signin = async (state, data) => {
  return createRequest(`/api/users/signin`, state, {
    method: 'POST',
    body: data,
  }).then((res) => handleError(res));
};

export const signup = async (state, data) => {
  return createRequest(`/api/users`, state, {
    method: 'POST',
    body: data,
  }).then((res) => handleError(res));
};

export const getUser = async (state) => {
  return createRequest(`/api/user`, state, {
    method: 'GET',
  }).then((res) => handleError(res));
};

export const getUsers = async (state) => {
  return createRequest(`/api/users`, state, {
    method: 'GET',
  }).then((res) => handleError(res));
};

export const updatePassword = async (state, data) => {
  return createRequest(`/api/users/password`, state, {
    method: 'PUT',
    body: data,
  }).then((res) => handleError(res));
};

export const updateUser = async (state, data) => {
  const { id, ...body } = data;
  return createRequest(`/api/users/${id}`, state, {
    method: 'PUT',
    body,
    vgs: true,
  }).then((res) => handleError(res));
};

export const sendPasswordReset = async (state, data) => {
  return createRequest(`/api/users/password/reset`, state, {
    method: 'PUT',
    body: data,
  }).then((res) => handleError(res));
};

export const createNewPassword = async (state, data) => {
  const { id, ...body } = data;
  const qStr = createParams({ id });
  return createRequest(`/api/expiring_link${qStr}`, state, {
    method: 'POST',
    body,
  }).then((res) => handleError(res));
};
