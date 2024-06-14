import React from 'react';
import css from 'classnames';
import { makeStyles } from '@material-ui/core/styles';
import { Select as MUISelect } from '@material-ui/core';

const useStyles = makeStyles((theme) => ({
  select: {
    borderRadius: 0,
  },
}));

const Button = ({ children, ...props }) => {
  const classes = useStyles();

  const { className } = props;
  return (
    <MUISelect className={css(classes.select, className)} {...props}>
      {children}
    </MUISelect>
  );
};

export default Button;
