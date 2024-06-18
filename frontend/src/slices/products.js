import { createSlice, createSelector } from '@reduxjs/toolkit';

import {
  getProducts as getProductsAPI,
  createProduct as createProductAPI,
  updateProduct as updateProductAPI,
  deleteProduct as deleteProductAPI,
} from 'api/products';
import { emptyProduct } from 'fixtures/products';
import {
  getGenericStarted,
  getGenericFailure,
  getGenericSuccess,
  getPayloadSuccess,
  getGenericState,
  handleError,
} from './sliceUtils';

export const initialProductsState = {
  createProduct: getGenericState(),
  updateProduct: getGenericState(),
  products: getGenericState([]),
  deleteProduct: getGenericState(),
};

export const productsSlice = createSlice({
  name: 'products',
  initialState: initialProductsState,
  reducers: {
    createProductStarted: getGenericStarted('createProduct'),
    createProductSuccess: getGenericSuccess('createProduct'),
    createProductFailure: getGenericFailure('createProduct'),

    getProductsStarted: getGenericStarted('products'),
    getProductsSuccess: getPayloadSuccess('products'),
    getProductsFailure: getGenericFailure('products'),

    updateProductStarted: getGenericStarted('updateProduct'),
    updateProductSuccess: getGenericSuccess('updateProduct'),
    updateProductFailure: getGenericFailure('updateProduct'),

    deleteProductStarted: getGenericStarted('deleteProduct'),
    deleteProductSuccess: getGenericSuccess('deleteProduct'),
    deleteProductFailure: getGenericFailure('deleteProduct'),
  },
});

export const {
  createProductStarted,
  createProductSuccess,
  createProductFailure,

  getProductsStarted,
  getProductsSuccess,
  getProductsFailure,

  updateProductStarted,
  updateProductSuccess,
  updateProductFailure,

  deleteProductStarted,
  deleteProductSuccess,
  deleteProductFailure,
} = productsSlice.actions;

export default productsSlice.reducer;

export const getProducts = () => async (dispatch, getState) => {
  dispatch(getProductsStarted());
  try {
    const res = await getProductsAPI(getState());
    dispatch(getProductsSuccess(res));
  } catch (err) {
    handleError(
      err,
      dispatch,
      getProductsFailure,
      'There was an issue retrieving your Products'
    );
  }
};

export const createProduct = (data) => async (dispatch, getState) => {
  dispatch(createProductStarted());
  try {
    const res = await createProductAPI(getState(), data);
    dispatch(createProductSuccess(res));
    dispatch(getProducts());
    return res;
  } catch (err) {
    handleError(
      err,
      dispatch,
      createProductFailure,
      'There was an issue creating your Agent/ Manager'
    );
  }
};

export const updateProduct = (data) => async (dispatch, getState) => {
  dispatch(updateProductStarted());
  try {
    const res = await updateProductAPI(getState(), data);
    dispatch(updateProductSuccess(res));
    dispatch(getProducts());
    return res;
  } catch (err) {
    handleError(
      err,
      dispatch,
      updateProductFailure,
      'There was an issue updating your Agent/ Manager'
    );
  }
};

export const deleteProduct = (ids) => async (dispatch, getState) => {
  dispatch(deleteProductStarted());
  try {
    await Promise.all(ids.map((id) => deleteProductAPI(getState(), id)));
    dispatch(deleteProductSuccess());
    dispatch(getProducts());
  } catch (err) {
    handleError(
      err,
      dispatch,
      deleteProductFailure,
      'There was an issue deleting this Agent/ Manager'
    );
  }
};

// selectors
const selectProducts = (state) => state.products || initialProductsState;
const selectId = (_, id) => id;

export const createProductSelector = createSelector(
  selectProducts,
  (productsState = {}) => productsState.createProduct || getGenericState()
);

export const updateProductSelector = createSelector(
  selectProducts,
  (productsState = {}) => productsState.updateProduct || getGenericState()
);

export const productsSelector = createSelector(
  selectProducts,
  (productsState = {}) => productsState.products || getGenericState()
);

export const deleteProductSelector = createSelector(
  selectProducts,
  (productsState = {}) => productsState.deleteProduct || getGenericState()
);

export const productDetailsSelector = createSelector(
  [productsSelector, selectId],
  (productsState, id) => {
    const { data: products } = productsState;
    return products.find((product) => product.id === id) || emptyProduct;
  }
);
