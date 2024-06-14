import React from 'react';
import { Tabs as MUITabs, Tab } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  tabs: {
    maxWidth: '100%',
  },
  tab: {
    paddingLeft: theme.spacing(2.5),
    paddingRight: theme.spacing(2.5),
    textTransform: 'none',
    maxWidth: 'none',
    minWidth: '0',
    fontSize: '26px',
    lineHeight: '32px',
    color: theme.palette.shades.charcoalNew,
    fontWeight: 600,
    '&.Mui-selected': {
      color: theme.palette.shades.jetBlack,
    },
    '&:hover': {
      color: theme.palette.shades.jetBlack,
      opacity: 1,
    },
  },
}));

export default function Tabs(props) {
  const { tabLabels } = props;

  const classes = useStyles();

  return (
    <MUITabs
      variant="scrollable"
      scroll="auto"
      className={classes.tabs}
      indicatorColor="none"
      splash
      {...props}
    >
      {tabLabels.map((label) => (
        <Tab className={classes.tab} label={label} key={`tab-${label}`} />
      ))}
    </MUITabs>
  );
}
