import React, { useState } from "react"
import { useSelector } from "react-redux"
import { useLocation } from "react-router-dom"
import { makeStyles } from "@material-ui/core/styles"
import { IconButton, Popover } from "@material-ui/core"
import { ListSubheader, Divider, List, AppBar, Toolbar } from "@material-ui/core"
import css from "classnames"

import global from "styles/global"
import PageHeader from "components/PageHeader"
import { expandedWidth, collapsedWidth } from "components/NavDrawer"

import agentsMngrsImg from "assets/headerImgs/agentsMngrs.jpg"
import campaignsImg from "assets/headerImgs/campaigns.jpg"
import contractsImg from "assets/headerImgs/contracts.jpg"
import creatorsImg from "assets/headerImgs/creators.jpg"
import customersImg from "assets/headerImgs/customers.jpg"
import homeImg from "assets/headerImgs/home.jpg"
import invoicesImg from "assets/headerImgs/invoices.jpg"
import paymentsImg from "assets/headerImgs/payments.jpg"
import settingsImg from "assets/headerImgs/settings.jpg"
import walletsImg from "assets/headerImgs/wallets.jpg"
import { isExpandedSelector } from "slices/misc"

const useStyles = makeStyles((theme) => ({
  expandedPageHeader: {
    marginLeft: expandedWidth,
    alignSelf: "end",
  },
  collapsedPageHeader: {
    marginLeft: collapsedWidth,
    alignSelf: "end",
  },
  toolbar: {
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
  },
  appBar: {
    // height: '195px',
  },
  title: {
    color: theme.palette.shades.jetBlack092,
    textAlign: "right",
  },
  logoFull: {
    paddingTop: theme.spacing(1),
    paddingBottom: 0,
    [theme.breakpoints.down("xs")]: {
      display: "none",
    },
  },
  logoSmall: {
    paddingTop: theme.spacing(0.5),
    [theme.breakpoints.up("sm")]: {
      display: "none",
    },
  },
  notificationsIcon: {
    color: theme.palette.shades.white,
  },
}))

const headerImgs = {
  agentsManagers: agentsMngrsImg,
  campaigns: campaignsImg,
  contracts: contractsImg,
  creators: creatorsImg,
  customers: customersImg,
  home: homeImg,
  invoices: invoicesImg,
  payments: paymentsImg,
  settings: settingsImg,
  wallets: walletsImg,
}

const Header = () => {
  const g = global()
  const classes = useStyles()
  const location = useLocation()

  const pathTokens = location.pathname.split("/")
  const pathRoot = false ? pathTokens[2] : pathTokens[1]
  const headerImg = headerImgs[pathRoot] || homeImg

  const [anchorEl, setAnchorEl] = useState(null)
  const isExpanded = useSelector(isExpandedSelector)

  const handleClickBell = (event) => {
    event.preventDefault()
    setAnchorEl(event.currentTarget)
  }

  // const handleClickNotification = (notification) => {}

  const handleClose = () => {
    setAnchorEl(null)
  }

  const open = Boolean(anchorEl)
  const id = open ? "simple-popover" : undefined

  return (
    <AppBar
      position="fixed"
      className={classes.appBar}
      elevation={0}
      style={{
        background: `radial-gradient(circle, transparent 10%, rgba(0,0,0,.4) 70%), url(${headerImg})`,
      }}
    >
      <Toolbar className={css(classes.toolbar, g.flexRowSpacing, g.alignStart_i)}>
        <div
          className={css({
            [classes.expandedPageHeader]: isExpanded,
            [classes.collapsedPageHeader]: !isExpanded,
          })}
        >
          <PageHeader />
        </div>

        <div>
          {/* Org App Bar */}
          <div className={css(g.flexRowSpacing, g.alignCenter, g.mt_sm)}>
            {/* Notifications */}
            <div className={g.ml_xs}>
              <IconButton
                onClick={handleClickBell}
                aria-describedby={id}
                className={classes.notificationsIcon}
                color="inherit"
              >
                {/* <Badge badgeContent={notifications.length} color="secondary">
                  <NotificationsIcon />
                </Badge> */}
              </IconButton>
              <Popover
                id={id}
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "center",
                }}
                transformOrigin={{
                  vertical: "top",
                  horizontal: "center",
                }}
              >
                <List component="nav" subheader={<ListSubheader>Notifications</ListSubheader>}>
                  <Divider />

                  {/* {notifications.map((notification) => (
                    <ListItem
                      key={notification.id}
                      button
                      onClick={() => handleClickNotification(notification)}
                    >
                      <ListItemText>{notification.text}</ListItemText>
                    </ListItem>
                  ))} */}
                  {/* <ListItem
                    button
                    onClick={() =>
                      history.push(
                        isExternal
                          ? '/creator/settings?tab=notifications'
                          : '/settings?tab=notifications'
                      )
                    }
                  >
                    <ListItemIcon>
                      <NavigateNextIcon />
                    </ListItemIcon>
                    <ListItemText>See all Notifications</ListItemText>
                  </ListItem> */}
                </List>
              </Popover>
            </div>
          </div>
        </div>
      </Toolbar>
    </AppBar>
  )
}

export default Header
