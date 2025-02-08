export const getIsDev = () => process.env.NODE_ENV === 'development';

export const getIsIntlPayments = () => getIsDev;

export const getIsDemo = () => process.env.REACT_APP_DEMO === 'true';

export const getIsProd = () =>
  process.env.REACT_APP_DEMO !== 'true' &&
  process.env.NODE_ENV !== 'development';
