import React, { useState } from 'react';
import { connect } from 'react-redux';
import { ButtonGroup, Grid, Link, Typography } from '@material-ui/core';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import isEmail from 'validator/lib/isEmail';
import css from 'classnames';

import {
  signinStateSelector,
  sendPasswordReset as sendPasswordResetSlice,
  sendPasswordResetStateSelector,
} from 'slices/users';
import global, { colors } from 'styles/global';
import WelcomeBackground from 'components/WelcomeBackground';
import { signin as signinSlice } from 'slices/users';
import TextField from 'components/TextFieldDark';
import Card from 'components/Card';
import Button from 'components/Button';
import { ForgotPasswordModal } from './ForgotPasswordModal';

const useStyles = makeStyles((theme) => ({
  logo: {
    width: '60%',
    height: 'auto',
    padding: 0,
  },
  fullHeight: {
    height: 'calc(100vh - 72px)',
  },
  link: {
    textDecoration: 'underline',
  },
  welcomeCard: {
    paddingTop: 32,
    paddingBottom: 32,
    paddingLeft: 28,
    paddingRight: 28,
  },
}));

function SignIn({ signinState, sendPasswordReset, sendPasswordResetState }) {
  const classes = useStyles();
  const g = global();
  const history = useHistory();
  const dispatch = useDispatch();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { loading: submitting } = signinState;

  const [forgotPasswordModalOpen, setForgotPasswordModalOpen] = useState(false);

  const handleSignin = async (evt) => {
    evt.preventDefault();
    // current not using isTeamMember in sign in, could add later
    await dispatch(signinSlice({ email, password }, () => history.push('/')));
  };

  const showForgotPasswordModal = () => {
    setForgotPasswordModalOpen(true);
  };

  const hideForgotPasswordModal = () => {
    setForgotPasswordModalOpen(false);
  };

  const isInputInvalid = email === '' || !isEmail(email) || password === '';

  return (
    <>
      <WelcomeBackground />
      <Grid
        container
        spacing={2}
        className={css(g.centered, classes.fullHeight)}
      >
        <Grid item sm={12} md={4} className={g.z_index_1}>
          <Card bgColor={colors.brand.payBlack} className={classes.welcomeCard}>
            <ForgotPasswordModal
              open={forgotPasswordModalOpen}
              onClose={hideForgotPasswordModal}
              sendPasswordReset={sendPasswordReset}
              sendPasswordResetState={sendPasswordResetState}
            />

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  margin="dense"
                  variant="outlined"
                  title="Email address"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                />
              </Grid>

              <Grid item xs={12} className={g.mb_lg}>
                <TextField
                  margin="dense"
                  variant="outlined"
                  title="Password"
                  type="password"
                  value={password}
                  formHelperText={
                    <Link
                      onClick={showForgotPasswordModal}
                      className={css(g.white, classes.link)}
                    >
                      Forgot password?
                    </Link>
                  }
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  fullWidth
                />
              </Grid>

              <Grid item xs={12} className={g.mb_xl_i}>
                <Button
                  onClick={handleSignin}
                  loading={submitting}
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isInputInvalid}
                  fullWidth
                >
                  Sign in
                </Button>
              </Grid>

              <Grid item xs={12}>
                <Typography className={css(g.mb_xs, g.white)} variant="h5">
                  Don't have an account?
                </Typography>
                <Button
                  onClick={() => history.push('/signup')}
                  type="submit"
                  variant="outlined"
                  color="primary"
                  fullWidth
                >
                  Sign up
                </Button>
              </Grid>
            </Grid>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}

const mapStateToProps = (state) => ({
  signinState: signinStateSelector(state),
  sendPasswordResetState: sendPasswordResetStateSelector(state),
});

const mapDispatchToProps = (dispatch) => ({
  sendPasswordReset: (data) => dispatch(sendPasswordResetSlice(data)),
});

export default connect(mapStateToProps, mapDispatchToProps)(SignIn);
