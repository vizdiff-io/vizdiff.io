import { toast } from 'react-toastify';

export const getGenericState = (data) => ({
  data,
  error: '',
  loading: false,
});

export const getGenericStarted = (key) => {
  return (state) => {
    if (!state[key]) {
      state[key] = {};
    }
    state[key].error = '';
    state[key].loading = true;
  };
};

export const getGenericSuccess = (key) => {
  return (state) => {
    state[key].error = '';
    state[key].loading = false;
  };
};

export const getPayloadSuccess = (key, dataKeyOverride) => {
  // sometimes it's nice to have a triplet with distinct loading/error states that still saves
  // to a common location for data]
  const dataKey = dataKeyOverride ?? key;
  return (state, action) => {
    state[dataKey].data = action.payload;
    state[key].error = '';
    state[key].loading = false;
  };
};

export const getGenericFailure = (key) => {
  return (state, action) => {
    if (!state[key]) {
      state[key] = getGenericState();
    }
    state[key].error = action.payload || '';
    state[key].loading = false;
  };
};

export const ensureData = (state, key, defaultData) => {
  if (!state[key]) {
    return getGenericState(defaultData);
  } else if (!state[key].data) {
    return {
      ...state[key],
      data: defaultData,
    };
  }
  return state[key];
};

export const getErrStr = (err, defaultMsg) => {
  const message = err?.message || defaultMsg || '';
  return message;
};

export const handleError = (err, dispatch, failFn, defaultStr) => {
  const errStr = getErrStr(err, defaultStr);
  toast.error(errStr[0].toUpperCase() + errStr.slice(1));
  dispatch(failFn(errStr));
};

export const handleErrorNoToast = (err, dispatch, failFn, defaultStr) => {
  const errStr = getErrStr(err, defaultStr);
  dispatch(failFn(errStr));
};
