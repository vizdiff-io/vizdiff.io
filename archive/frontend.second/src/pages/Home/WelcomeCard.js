import React from 'react';
import css from 'classnames';
import { makeStyles } from '@material-ui/core/styles';

import Button from 'components/Button';
import global from 'styles/global';
import onboardingSplash from 'assets/onboarding_splash.png';

const useStyles = makeStyles((theme) => ({
  activateButton: {
    position: 'absolute',
    bottom: '18%',
    right: '10%',
  },
}));

export default function WelcomeCard({ setActivateModalVisible }) {
  const g = global();
  const classes = useStyles();

  return (
    <div className={g.relative}>
      <img
        className={css(g.height_auto, g.full_width)}
        src={onboardingSplash}
        alt="onboarding splash"
      />
      <div className={classes.activateButton}>
        <Button
          variant="contained"
          size="large"
          onClick={() => setActivateModalVisible(true)}
        >
          Activate your account
        </Button>
      </div>
    </div>
  );
}
