import { handleError } from 'api/utils';
import { createRequest } from 'api/request';

export const createProduct = async (state, data) => {
  return createRequest(`/api/products`, state, {
    method: 'POST',
    body: data,
  }).then((res) => handleError(res));
};

export const getProducts = async (state) => {
  return createRequest(`/api/products`, state, {
    method: 'GET',
  }).then((res) => handleError(res));
};

export const updateProduct = async (state, data) => {
  const { id, ...body } = data;
  return createRequest(`/api/products/${id}`, state, {
    method: 'PUT',
    body,
  }).then((res) => handleError(res));
};

export const deleteProduct = async (state, id) => {
  return createRequest(`/api/products/${id}`, state, {
    method: 'DELETE',
  }).then((res) => handleError(res));
};
