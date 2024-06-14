import React from 'react';
import css from 'classnames';
import { makeStyles } from '@material-ui/core/styles';
import { Button as MUIButton, CircularProgress } from '@material-ui/core';

const useStyles = makeStyles((theme) => ({
  button: {
    boxShadow: 'none',
    textTransform: 'none',
    borderRadius: 0,
    fontWeight: '600',
    '&.Mui-disabled': {
      opacity: 0.4,
    },
    '&.MuiButton-containedPrimary': {
      '&.Mui-disabled': {
        color: theme.palette.shades.white,
        backgroundColor: theme.palette.brand.payBlue,
      },
    },
    '&.MuiButton-containedSecondary': {
      '&.Mui-disabled': {
        color: theme.palette.shades.jetBlack,
      },
    },
    '&.MuiButton-outlinedPrimary': {
      backgroundColor: theme.palette.shades.lightBlueNew,
      borderColor: theme.palette.shades.lightBlueNew,
      '&.Mui-disabled': {
        color: theme.palette.brand.payBlue,
      },
      '&:hover': {
        backgroundColor: theme.palette.shades.lightBlueNewDarkened,
      },
    },
    '&.MuiButton-outlinedSecondary': {
      backgroundColor: theme.palette.shades.lightRedNew,
      borderColor: theme.palette.shades.lightRedNew,
      color: theme.palette.error.main,
      '&:hover': {
        backgroundColor: theme.palette.shades.lightRedNewDarkened,
      },
    },
  },
  loading: { marginRight: '8px', color: 'inherit' },
}));

const Button = ({ loading = false, children, ...props }) => {
  const classes = useStyles();

  const icon = loading ? null : props.startIcon;
  const { disabled, className, isIcon, ...remainingProps } = props;
  return (
    <MUIButton
      color="primary"
      className={css(classes.button, className)}
      {...remainingProps}
      startIcon={icon}
      disabled={disabled || loading}
      disableElevation
    >
      {loading && <CircularProgress size={18} className={classes.loading} />}
      {(!isIcon || !loading) && children}
    </MUIButton>
  );
};

export default Button;
