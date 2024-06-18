import { Redirect, Route } from "react-router-dom"

export default function ProtectedRoute({ token, org, children, path, ...rest }) {
  const loggedIn = !!token

  return (
    <Route
      path={path}
      {...rest}
      render={({ location }) => {
        if (!loggedIn) {
          return location.pathname === "/signup" || location.pathname === "/signin" ? (
            children
          ) : (
            <Redirect to={{ pathname: "/signup", state: { from: location } }} />
          )
        }

        // if you're fully authed, you shouldn't be able to see onboarding pages
        if (
          location.pathname === "/auth" ||
          location.pathname === "/signin" ||
          location.pathname === "/signup"
        ) {
          return <Redirect to={{ pathname: "/", state: { from: location } }} />
        }
        return children
      }}
    />
  )
}
