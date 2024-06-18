import React from "react"
import css from "classnames"
import { useDispatch, useSelector } from "react-redux"
import { useHistory, useLocation } from "react-router-dom"
import ListItem from "@material-ui/core/ListItem"
import { Typography } from "@material-ui/core"
import HomeIcon from "@mui/icons-material/Home"
import DollarIcon from "@mui/icons-material/AttachMoney"
import PeopleIcon from "@mui/icons-material/People"
import ReceiptIcon from "@mui/icons-material/Receipt"
import ExitToAppIcon from "@mui/icons-material/ExitToApp"
import BusinessIcon from "@mui/icons-material/Business"
import SettingsIcon from "@mui/icons-material/Settings"
import { makeStyles } from "@material-ui/core/styles"
import AssignmentIcon from "@mui/icons-material/Assignment"
import ChevronRight from "@mui/icons-material/ChevronRight"
import ChevronLeft from "@mui/icons-material/ChevronLeft"
import CodeIcon from "@mui/icons-material/Code"
import { logout } from "slices/users"
import global from "styles/global"
import { currentUserSelector } from "slices/users"
import { isOwnerOrAdmin } from "util/user"

const useStyles = makeStyles((theme) => ({
  container: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    height: "100%",
  },
  navItem: {
    color: theme.palette.shades.white,
    padding: theme.spacing(0),
    paddingLeft: theme.spacing(1),
    whiteSpace: "nowrap",
    "&:hover": {
      backgroundColor: `${theme.palette.shades.charcoal036}`,
    },
  },
  icon: {
    color: theme.palette.shades.white,
  },
  iconWrapper: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(1.25),
    height: "40px",
  },
  customIcon: {
    width: 26,
  },
  activeLink: {
    backgroundColor: `${theme.palette.brand.payBlue} !important`,

    "& $h5": {
      fontWeight: "bold",
    },
  },
  nested: {
    paddingLeft: theme.spacing(4),
  },
  divider: {
    backgroundColor: theme.palette.shades.white,
  },
  label: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(1.25),
    height: "40px",
  },
}))

const NavItems = ({ setIsExpanded, isExpanded }) => {
  const g = global()
  const location = useLocation()
  const history = useHistory()
  const classes = useStyles()
  const dispatch = useDispatch()

  const { data: user } = useSelector(currentUserSelector)

  const signOut = () => {
    dispatch(logout())
    history.push("/signin")
  }

  const openDocs = () => {
    window.open("https://docs.vizdiff.io", "_blank")
  }

  return (
    <div className={classes.container}>
      <div>
        <ListItem
          onClick={() => setIsExpanded(!isExpanded)}
          className={css(g.clickable, classes.navItem)}
        >
          <div className={classes.iconWrapper}>
            {isExpanded ? (
              <ChevronLeft className={classes.icon} />
            ) : (
              <ChevronRight className={classes.icon} />
            )}
          </div>
        </ListItem>
        {/* <Divider className={classes.divider} /> */}

        <ListItem
          button
          selected={location.pathname === "/"}
          onClick={() => history.push("/")}
          className={classes.navItem}
          classes={{
            selected: classes.activeLink,
          }}
        >
          {!isExpanded ? (
            <div className={classes.iconWrapper}>
              <HomeIcon className={classes.icon} />
            </div>
          ) : (
            <Typography disableTypography variant="h5" className={classes.label}>
              Home
            </Typography>
          )}
        </ListItem>

        {isOwnerOrAdmin(user) && (
          <ListItem
            button
            selected={location.pathname.includes("/wallets")}
            onClick={() => history.push("/wallets")}
            className={classes.navItem}
            classes={{
              selected: classes.activeLink,
            }}
          >
            {!isExpanded ? (
              <div className={classes.iconWrapper}>
                <DollarIcon className={classes.icon} />
              </div>
            ) : (
              <Typography disableTypography variant="h5" className={classes.label}>
                Wallets
              </Typography>
            )}
          </ListItem>
        )}

        <ListItem
          button
          selected={location.pathname.includes("/employees")}
          onClick={() => history.push("/employees")}
          className={classes.navItem}
          classes={{
            selected: classes.activeLink,
          }}
        >
          {!isExpanded ? (
            <div className={classes.iconWrapper}>
              <PeopleIcon className={classes.icon} />
            </div>
          ) : (
            <Typography disableTypography variant="h5" className={classes.label}>
              Employees
            </Typography>
          )}
        </ListItem>

        <ListItem
          button
          selected={location.pathname.includes("/projects")}
          onClick={() => history.push("/projects")}
          className={classes.navItem}
          classes={{
            selected: classes.activeLink,
          }}
        >
          {!isExpanded ? (
            <div className={classes.iconWrapper}>
              <AssignmentIcon className={classes.icon} />
            </div>
          ) : (
            <Typography disableTypography variant="h5" className={classes.label}>
              Projects
            </Typography>
          )}
        </ListItem>

        {/* <ListItem
          button
          selected={location.pathname.includes('/campaigns')}
          onClick={() => history.push('/campaigns')}
          className={css(classes.navItem)}
          classes={{
            selected: classes.activeLink,
          }}
        >
          {!isExpanded ? (
            <div className={classes.iconWrapper}>
              <BusinessCenterIcon className={classes.icon} />
            </div>
          ) : (
            <Typography
              disableTypography
              variant="h5"
              className={classes.label}
            >
              Campaigns
            </Typography>
          )}
        </ListItem>
         */}
        {/*
        <ListItem
          button
          selected={location.pathname.includes('/agentsManagers')}
          onClick={() => history.push('/agentsManagers')}
          className={css(classes.navItem)}
          classes={{
            selected: classes.activeLink,
          }}
        >
          {!isExpanded ? (
            <div className={classes.iconWrapper}>
              <HailIcon className={classes.icon} />
            </div>
          ) : (
            <Typography
              disableTypography
              variant="h5"
              className={classes.label}
            >
              Agents/ Managers
            </Typography>
          )}
        </ListItem> */}

        <ListItem
          button
          selected={location.pathname.includes("/customers")}
          onClick={() => history.push("/customers")}
          className={css(classes.navItem)}
          classes={{
            selected: classes.activeLink,
          }}
        >
          {!isExpanded ? (
            <div className={classes.iconWrapper}>
              <BusinessIcon className={classes.icon} />
            </div>
          ) : (
            <Typography disableTypography variant="h5" className={classes.label}>
              Customers
            </Typography>
          )}
        </ListItem>

        <ListItem
          button
          selected={location.pathname.includes("/invoices")}
          onClick={() => history.push("/invoices")}
          className={css(classes.navItem)}
          classes={{
            selected: classes.activeLink,
          }}
        >
          {!isExpanded ? (
            <div className={classes.iconWrapper}>
              <ReceiptIcon className={classes.icon} />
            </div>
          ) : (
            <Typography disableTypography variant="h5" className={classes.label}>
              Invoices
            </Typography>
          )}
        </ListItem>

        <ListItem
          button
          selected={location.pathname.includes("/settings")}
          onClick={() => history.push("/settings")}
          className={classes.navItem}
          classes={{
            selected: classes.activeLink,
          }}
        >
          {!isExpanded ? (
            <div className={classes.iconWrapper}>
              <SettingsIcon className={classes.icon} />
            </div>
          ) : (
            <Typography disableTypography variant="h5" className={classes.label}>
              Settings
            </Typography>
          )}
        </ListItem>
      </div>
      <div>
        <ListItem button onClick={openDocs} className={classes.navItem}>
          {!isExpanded ? (
            <div className={classes.iconWrapper}>
              <CodeIcon className={classes.icon} />
            </div>
          ) : (
            <Typography disableTypography variant="h5" className={classes.label}>
              API Reference
            </Typography>
          )}
        </ListItem>

        <ListItem button onClick={signOut} className={classes.navItem}>
          {!isExpanded ? (
            <div className={classes.iconWrapper}>
              <ExitToAppIcon className={classes.icon} />
            </div>
          ) : (
            <Typography disableTypography variant="h5" className={classes.label}>
              Sign out
            </Typography>
          )}
        </ListItem>
      </div>
    </div>
  )
}

export default NavItems
