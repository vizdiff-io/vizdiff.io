import React from 'react';
import css from 'classnames';
import { makeStyles } from '@material-ui/core/styles';
import MUITextField from '@material-ui/core/TextField';
import { FormHelperText, Typography } from '@material-ui/core';

import global from 'styles/global';

const useStyles = makeStyles((theme) => ({
  input: {
    backgroundColor: theme.palette.shades.white,
    '& fieldset': {
      borderRadius: '0',
    },

    '& .MuiInputBase-input.Mui-disabled': {
      backgroundColor: theme.palette.shades.charcoal004,
    },
  },
  title: {
    textTransform: 'uppercase',
  },
}));

const TextField = ({ ...props }) => {
  const classes = useStyles();
  const g = global();

  return (
    <>
      <Typography className={css(g.white, classes.title)} variant="h6">
        {props.title}
      </Typography>
      {/* <Typography className={classes.darkTitle} variant="h5">{props.title}</Typography> */}
      <MUITextField
        {...props}
        className={css(props.className, classes.input)}
      />
      <FormHelperText
        className={props.hasError ? g.error : g.white}
        id="my-helper-text"
      >
        {props.formHelperText}
      </FormHelperText>
    </>
  );
};

export default TextField;
