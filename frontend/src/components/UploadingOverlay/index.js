import React from 'react';
import Backdrop from '@material-ui/core/Backdrop';
import Typography from '@material-ui/core/Typography';
import CircularProgress from '@material-ui/core/CircularProgress';
import { makeStyles } from '@material-ui/core/styles';
import { formatPercent } from 'util/renderStrings';
import global from 'styles/global';

const useStyles = makeStyles((theme) => ({
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
    color: '#fff',
  },
}));

export default function UploadingOverlay({ open, progress }) {
  const classes = useStyles();
  const g = global();

  return (
    <div>
      <Backdrop className={classes.backdrop} open={open}>
        <CircularProgress color="inherit" />
        <Typography className={g.ml_md} variant="h3">
          {formatPercent(progress, 0)}
        </Typography>
      </Backdrop>
    </div>
  );
}
