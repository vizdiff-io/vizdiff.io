import React from 'react';
import global from 'styles/global';

export default function TabPanel(props) {
  const { children, value, index, noMargin, ...other } = props;
  const g = global();

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <div className={noMargin ? g.mt_zero : g.mt_lg}>{children}</div>
      )}
    </div>
  );
}
