import React, { useEffect } from "react"
import { Switch, Redirect, Route, useLocation } from "react-router-dom"
import { makeStyles } from "@material-ui/core/styles"
import CssBaseline from "@material-ui/core/CssBaseline"
import Box from "@material-ui/core/Box"
import Typography from "@material-ui/core/Typography"
import Container from "@material-ui/core/Container"
import Link from "@material-ui/core/Link"
import Cookies from "universal-cookie"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import constants from "constants/index"

import AppBar from "components/AppBar"
import NavDrawer from "components/NavDrawer"
import ProtectedRoute from "components/ProtectedRoute"
import Home from "pages/Home"
import SignUp from "pages/SignUp"
import SignIn from "pages/SignIn"
import Projects from "pages/Projects"
import NewProject from "pages/Projects/New"
import ProjectDetail from "pages/Projects/Detail"
import ResetPassword from "pages/ResetPassword"

const cookies = new Cookies(null, { path: "/" })
const token = cookies.get("token")

const useFooterStyles = makeStyles((theme) => ({
  footer: {
    textAlign: "center",
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
}))

function Footer() {
  const classes = useFooterStyles()
  return (
    <div className={classes.footer}>
      <Typography variant="subtitle1" color="textSecondary">
        {"Copyright © "}
        <Link color="inherit" href="https://vizdiff.io/">
          VizDiff
        </Link>{" "}
        {new Date().getFullYear()}
        {"."}
      </Typography>
    </div>
  )
}

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    background: theme.palette.shades.white,
  },
  appBarSpacer: theme.mixins.toolbar,
  bannerSpacer: {
    minHeight: constants.bannerSpacer,
  },
  content: {
    flexGrow: 1,
    overflow: "auto",
  },
  container: {
    minHeight: `calc(100vh - ${constants.headerHeight}px - 72px)`,
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
}))

export default function App() {
  const location = useLocation()
  const classes = useStyles()

  const refreshData = async () => {
    // await getUser();
    // if (isExternal) {
    //   getOrgs();
    // } else {
    //   getOrg();
    // }
  }

  useEffect(() => {
    refreshData()
  }, [])

  const hideNavBar =
    location.pathname.includes("/auth") ||
    location.pathname.includes("/invoices/pay") ||
    location.pathname.includes("/resetPassword") ||
    location.pathname.includes("/signup") ||
    location.pathname.includes("printable") ||
    location.pathname.includes("/signin")

  const hideFooter =
    location.pathname.includes("/signup") ||
    location.pathname.includes("/signin") ||
    location.pathname.includes("/resetPassword") ||
    location.pathname.includes("/printable")

  // const currentUser = useSelector(currentUserSelector)

  // github auth stuff
  const scope = "repo,read:org"
  const redirectUri = String(process.env.REACT_APP_PUBLIC_APP_URL)
  const state = encodeURIComponent(`redirect=${encodeURIComponent(redirectUri)}`)
  const clientId = process.env.REACT_APP_PUBLIC_GITHUB_CLIENT_ID
  const callbackUri = encodeURIComponent(
    `${process.env.REACT_APP_PUBLIC_API_URL}/auth/github/callback`,
  )
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${callbackUri}&scope=${scope}&state=${state}`

  return (
    <div className={classes.root}>
      <CssBaseline />
      <ToastContainer
        position="top-center"
        autoClose={5000}
        hideProgressBar={false}
        closeOnClick
        draggable={false}
        pauseOnHover
      />
      {/* <LoadingOverlay open={loading} /> */}

      {!hideNavBar && <AppBar />}

      {!hideNavBar && <NavDrawer />}

      <main className={classes.content}>
        {!hideNavBar && <div className={classes.appBarSpacer} />}

        <Container maxWidth="lg" className={classes.container}>
          <Switch>
            <Route
              path="/github-auth"
              component={() => {
                window.location.href = authUrl
                return null
              }}
            />
            {/* Logged in Routes */}
            <ProtectedRoute path="/" token={token} exact>
              <Home />
            </ProtectedRoute>

            <ProtectedRoute path="/auth" token={token}>
              <SignUp />
            </ProtectedRoute>

            <ProtectedRoute path="/signup" token={token}>
              <SignUp />
            </ProtectedRoute>

            <ProtectedRoute path="/signin" token={token}>
              <SignIn />
            </ProtectedRoute>

            <ProtectedRoute path="/projects/new" token={token}>
              <NewProject />
            </ProtectedRoute>

            <ProtectedRoute path="/projects/:projectId" token={token}>
              <ProjectDetail />
            </ProtectedRoute>

            <ProtectedRoute path="/projects" token={token}>
              <Projects />
            </ProtectedRoute>

            {/* <ProtectedRoute
              path="/campaigns/:groupId"
              user={user}

              exact
            >
              <CampaignDetails />
            </ProtectedRoute> */}

            {/* Unprotected routes */}
            <Route path="/resetPassword/:linkId">
              <ResetPassword />
            </Route>

            {/* Since the path is not exact here, this actually catches all fall-through and reroutes it back to home */}
            <Route path="/">
              <Redirect to="/" />
            </Route>
          </Switch>
        </Container>
        {!hideFooter && (
          <Box pt={4}>
            <Footer />
          </Box>
        )}
      </main>
    </div>
  )
}
