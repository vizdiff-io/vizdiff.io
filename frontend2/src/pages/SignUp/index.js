import React, { useState } from "react"
import { connect, useDispatch } from "react-redux"
import { Grid, makeStyles, Typography } from "@material-ui/core"
import { useHistory } from "react-router-dom"
import isEmail from "validator/lib/isEmail"
import css from "classnames"

import { signupStateSelector } from "slices/users"
import global from "styles/global"
import WelcomeBackground from "components/WelcomeBackground"
import { signup as signupSlice } from "slices/users"
import { colors } from "styles/global"
import Button from "components/Button"
import TextField from "components/TextFieldDark"
import Card from "components/Card"

const useStyles = makeStyles((theme) => ({
  logo: {
    width: "60%",
    height: "auto",
    padding: 0,
  },
  fullHeight: {
    height: "calc(100vh - 72px)",
  },
  welcomeCard: {
    paddingTop: 32,
    paddingBottom: 32,
    paddingLeft: 28,
    paddingRight: 28,
  },
  invalidPassword: {
    color: theme.palette.error.main,
  },
}))

function SignUp({ signupState }) {
  const g = global()
  const history = useHistory()
  const classes = useStyles()
  const dispatch = useDispatch()

  const { loading: submitting } = signupState

  const [email, setEmail] = useState({ val: "", dirty: false })
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordIsValid, setPasswordIsValid] = useState(true)

  const handleSignup = async (evt) => {
    evt.preventDefault()

    const isPasswordValid = true //validatePassword(password);
    if (!isPasswordValid) {
      setPasswordIsValid(false)
      return
    } else {
      setPasswordIsValid(true)
    }

    await dispatch(
      signupSlice({ email: email.val.toLowerCase(), password }, () => history.push("/")),
    )
  }

  const isInputInvalid =
    email.val === "" ||
    !isEmail(email.val) ||
    password === "" ||
    confirmPassword === "" ||
    password !== confirmPassword

  return (
    <>
      <WelcomeBackground noEarth />
      <Grid container spacing={2} className={css(g.centered, classes.fullHeight)}>
        <Grid item sm={12} md={4} className={g.z_index_1}>
          <Card bgColor={colors.brand.payBlack} className={classes.welcomeCard}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <div className={css(g.centerChildren, g.mb_xxl)}>
                  <Typography variant="h2" className={g.white}>
                    Sign up for VizDiff
                  </Typography>
                </div>
              </Grid>

              <Grid item xs={12}>
                <Button
                  onClick={() => history.push("/github-auth")}
                  type="submit"
                  variant="outlined"
                  color="primary"
                  fullWidth
                >
                  Sign in with GitHub
                </Button>
              </Grid>
            </Grid>
          </Card>
        </Grid>
      </Grid>
    </>
  )
}

const mapStateToProps = (state) => ({
  signupState: signupStateSelector(state),
})

const mapDispatchToProps = (dispatch) => ({})

export default connect(mapStateToProps, mapDispatchToProps)(SignUp)
