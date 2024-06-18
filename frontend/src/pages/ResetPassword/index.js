import React, { useEffect, useState } from "react"
import { connect } from "react-redux"
import css from "classnames"
import { useHistory, useParams } from "react-router-dom"
import { Grid } from "@material-ui/core"
import global, { colors } from "styles/global"
import { makeStyles } from "@material-ui/core/styles"
import Button from "components/Button"

import {
  createNewPassword as createNewPasswordSlice,
  createNewPasswordStateSelector,
} from "slices/users"
import LoadingOverlay from "components/LoadingOverlay"
import TextField from "components/TextFieldDark"
import WelcomeBackground from "components/WelcomeBackground"
import Card from "components/Card"
import logo from "assets/vizdiff_logo.png"

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
}))

function ResetPassword({
  createNewPasswordState,
  createNewPassword,
  getExpiringLink,
  expiringLinkState,
}) {
  const { loading } = expiringLinkState

  const { linkId } = useParams()

  useEffect(() => {
    getExpiringLink(linkId)
  }, [getExpiringLink, linkId])

  const [password, setPassword] = useState("")

  const g = global()
  const classes = useStyles()
  const history = useHistory()

  const { loading: submitting } = createNewPasswordState

  const handleCreateNewPassword = () => {
    createNewPassword({ id: linkId, password })

    history.push("/")
  }

  const isInputInvalid = password === ""

  return (
    <>
      <LoadingOverlay open={loading} />
      <WelcomeBackground />
      <Grid container spacing={2} className={css(g.centered, classes.fullHeight)}>
        <Grid item sm={12} md={4} className={g.z_index_1}>
          <Card bgColor={colors.brand.payBlack} className={classes.welcomeCard}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <div className={css(g.centerChildren, g.mb_xxl)}>
                  <img src={logo} alt="VizDiff logo" className={classes.logo} />
                </div>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  margin="dense"
                  variant="outlined"
                  title="New password"
                  type="password"
                  formHelperText="Must be at least 8 characters long with a letter, digit, and a special character"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  fullWidth
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  onClick={handleCreateNewPassword}
                  loading={submitting}
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isInputInvalid}
                  fullWidth
                >
                  Reset
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
  createNewPasswordState: createNewPasswordStateSelector(state),
  // expiringLinkState: expiringLinkSelector(state),
})

const mapDispatchToProps = (dispatch) => ({
  createNewPassword: (data) => dispatch(createNewPasswordSlice(data)),
  // getExpiringLink: (id) => dispatch(getExpiringLinkSlice(id)),
})

export default connect(mapStateToProps, mapDispatchToProps)(ResetPassword)
