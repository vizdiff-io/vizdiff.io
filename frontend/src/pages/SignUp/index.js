import React from "react"
import { Grid, makeStyles, Typography } from "@material-ui/core"
import { useHistory } from "react-router-dom"
import css from "classnames"

import global from "styles/global"
import WelcomeBackground from "components/WelcomeBackground"
import { colors } from "styles/global"
import Button from "components/Button"
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

export default function SignUp() {
  const g = global()
  const history = useHistory()
  const classes = useStyles()

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
