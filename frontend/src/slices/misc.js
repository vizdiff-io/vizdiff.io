import { createSlice, createSelector } from '@reduxjs/toolkit';

const emptyHeaderData = {
  title: '',
  breadcrumbs: [],
};

export const misc = createSlice({
  name: 'misc',
  initialState: {
    isDemoMode: false,
    isOnboardingDismissed: false,
    businessAddress: {},
    headerImg: '',
    isExpanded: true,
    headerData: emptyHeaderData,
  },
  reducers: {
    setDemoMode: (state, action) => {
      state.isDemoMode = action.payload;
    },
    setFlag: (state, action) => {
      state[action.payload.flag] = action.payload.value;
    },
    setIsOnboardingDismissed: (state, action) => {
      state.isOnboardingDismissed = action.payload;
    },
    setBusinessAddress: (state, action) => {
      state.businessAddress = action.payload;
    },
    setHeaderImg: (state, action) => {
      state.headerImg = action.payload;
    },
    setIsExpanded: (state, action) => {
      state.isExpanded = action.payload;
    },
    setHeaderData: (state, action) => {
      state.headerData = action.payload;
    },
  },
});

export const {
  setDemoMode,
  setFlag,
  setIsOnboardingDismissed,
  setBusinessAddress,
  setHeaderImg,
  setIsExpanded,
  setHeaderData,
} = misc.actions;

export default misc.reducer;

// selectors
const selectMisc = (state) => state.misc;

export const miscSelector = createSelector(
  selectMisc,
  (miscState) => miscState
);

export const headerImgSelector = createSelector(
  selectMisc,
  (miscState) => miscState.headerImg || ''
);

export const businessAddressSelector = createSelector(
  selectMisc,
  (miscState) => miscState.businessAddress || {}
);

export const isExpandedSelector = createSelector(
  selectMisc,
  (miscState) => miscState.isExpanded
);

export const headerDataSelector = createSelector(
  selectMisc,
  (miscState) => miscState.headerData || emptyHeaderData
);
