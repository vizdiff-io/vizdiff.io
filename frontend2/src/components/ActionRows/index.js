import React from 'react';
import css from 'classnames';
import { Grid, IconButton, Typography } from '@material-ui/core';
import DeleteIcon from '@mui/icons-material/Delete';

import global from 'styles/global';

export default function ActionRows({
  children,
  rows = [],
  handleDelete,
  submitting,
  getIsDisabled = () => false,
}) {
  const g = global();

  return (
    <Grid container spacing={1}>
      {rows.map((row) => (
        <Grid item xs={12} key={row.title}>
          <div className={css(g.flexRowSpacing, g.alignCenter)}>
            <div>
              <Typography variant="h5">{row.title}</Typography>
              <Typography variant="subtitle1">{row.subtitle}</Typography>
            </div>
            <IconButton
              color="secondary"
              onClick={() => handleDelete(row)}
              disabled={getIsDisabled(row) || submitting}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </div>
        </Grid>
      ))}
      {children}
    </Grid>
  );
}
