import React from 'react';
import css from 'classnames';
import { makeStyles } from '@material-ui/core/styles';
import { Typography } from '@material-ui/core';
import global from 'styles/global';

const useStyles = makeStyles(() => ({
  dottedBorder: {
    borderBottom: '1px dotted black',
    width: '100%',
  },
}));

const TypographyWithDots = ({ variant, children, className }) => {
  const classes = useStyles();
  const g = global();
  return (
    <div className={css(className, g.flexRow)}>
      <Typography className={g.nowrap} variant={variant}>
        {children}
      </Typography>
      <div className={classes.dottedBorder}></div>
    </div>
  );
};

export default TypographyWithDots;
