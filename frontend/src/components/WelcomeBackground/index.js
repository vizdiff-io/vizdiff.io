import React from 'react';
import { makeStyles } from '@material-ui/core/styles';

import authBackground from 'assets/auth_bg.jpg';
import authBackgroundNoEarth from 'assets/auth_bg_no_earth.jpg';

const useStyles = makeStyles((theme) => ({
  welcomeBG: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    height: '100vh',
    width: '100vw',
    backgroundSize: 'cover',
    backgroundPosition: 'bottom',
  },
}));

function WelcomeBackground({ noEarth }) {
  const classes = useStyles();

  return (
    <div
      className={classes.welcomeBG}
      style={{
        backgroundImage: `url(${
          noEarth ? authBackgroundNoEarth : authBackground
        })`,
      }}
    />
  );
}

export default WelcomeBackground;
