import { createTheme } from '@material-ui/core/styles';
import {
  dazzedThin,
  dazzedLight,
  dazzedRegular,
  dazzedMedium,
  dazzedSemiBold,
  dazzedBold,
  dazzedHeavy,
} from 'assets/fonts';
import { colors } from 'styles/global';

export const theme = createTheme({
  palette: {
    primary: {
      ...colors.primary,
    },
    success: {
      ...colors.success,
    },
    error: {
      ...colors.error,
    },
    shades: {
      ...colors.shades,
    },
    custom: {
      ...colors.custom,
    },
    brand: {
      ...colors.brand,
    },
    cash: {
      ...colors.cash,
    },
    card: {
      ...colors.card,
    },
    grow: {
      ...colors.grow,
    },
  },
  typography: {
    fontFamily: [
      'Dazzed',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
    h1: {
      fontSize: '40px',
      lineHeight: '40px',
      fontWeight: 600,
    },
    h2: {
      fontSize: '24px',
      lineHeight: '28px',
      fontWeight: 600,
    },
    h3: {
      fontSize: '20px',
      lineHeight: '24px',
      fontWeight: 600,
    },
    h4: {
      fontSize: '16px',
      lineHeight: '16px',
      fontWeight: 600,
      letterSpacing: '0.05em',
    },
    h5: {
      fontSize: '14px',
      lineHeight: '14px',
      fontWeight: 600,
      letterSpacing: '0.05em',
    },
    h6: {
      fontSize: '12px',
      lineHeight: '12px',
      fontWeight: 600,
      letterSpacing: '0.05em',
    },
    body1: {
      fontSize: '16px',
      lineHeight: '24px',
      fontWeight: 500,
    },
    body2: {
      fontSize: '14px',
      lineHeight: '20px',
      fontWeight: 500,
    },
    subtitle1: {
      fontSize: '12px',
      lineHeight: '16px',
      fontWeight: 400,
    },
    subtitle2: {
      fontSize: '10px',
      lineHeight: '14px',
      fontWeight: 400,
    },
    caption: {
      fontSize: '10px',
      lineHeight: '10px',
      fontWeight: 600,
      letterSpacing: '0.05em',
    },
    overline: {
      fontSize: '8px',
      lineHeight: '8px',
      fontWeight: 600,
      letterSpacing: '0.05em',
    },
  },
  overrides: {
    MuiCssBaseline: {
      '@global': {
        '@font-face': [
          dazzedThin,
          dazzedLight,
          dazzedRegular,
          dazzedMedium,
          dazzedSemiBold,
          dazzedBold,
          dazzedHeavy,
        ],
      },
    },
  },
  mixins: {
    toolbar: {
      minHeight: 150,
    },
  },
});

export default theme;
