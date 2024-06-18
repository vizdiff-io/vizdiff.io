import React from 'react';
import { IconButton, makeStyles, Tooltip } from '@material-ui/core';
import InfoIcon from '@mui/icons-material/Info';

const useStyles = makeStyles((theme) => ({
  iconButton: {
    paddingLeft: '4px',
    paddingTop: 0,
    paddingBottom: 0,
    paddingRight: 0,
  },
}));

const InfoTooltipIcon = ({ title, height }) => {
  const classes = useStyles();

  return (
    <Tooltip title={title}>
      <IconButton className={classes.iconButton}>
        <InfoIcon style={{ fontSize: height }} />
      </IconButton>
    </Tooltip>
  );
};

export default InfoTooltipIcon;
