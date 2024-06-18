import React from 'react';
import { Grid, makeStyles, Typography } from '@material-ui/core';

import global from 'styles/global';

const useStyles = makeStyles((theme) => ({
  label: {
    lineHeight: '24px',
  },
}));

const KeyValuePair = ({ label, value, valueClasses }) => {
  const g = global();
  const classes = useStyles();

  return (
    <Grid container spacing={1} className={g.mb_sm}>
      <Grid item sm={12} md={5}>
        <Typography variant="h6" className={classes.label}>
          {label}
        </Typography>
      </Grid>
      <Grid item sm={12} md={5}>
        <Typography className={valueClasses} variant="body1">
          {value}
        </Typography>
      </Grid>
    </Grid>
  );
};

export default KeyValuePair;
