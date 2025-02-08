import React from "react"
import css from "classnames"
import { useDispatch, useSelector } from "react-redux"
import { makeStyles } from "@material-ui/core/styles"
import Drawer from "@material-ui/core/Drawer"
import List from "@material-ui/core/List"
import { Link } from "react-router-dom"

import NavItems from "./NavItems"
import global from "styles/global"
import { setIsExpanded, isExpandedSelector } from "slices/misc"
import { Typography } from "@material-ui/core"

export const expandedWidth = "220px"
export const collapsedWidth = "60px"

const NavDrawer = () => {
  const dispatch = useDispatch()

  const g = global()

  const isExpanded = useSelector(isExpandedSelector)

  const useStyles = makeStyles((theme) => ({
    toolbarIcon: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: theme.spacing(8),
    },
    lightPadding: {
      paddingTop: theme.spacing(0),
      paddingLeft: theme.spacing(0.75),
      paddingRight: theme.spacing(0.75),
      paddingBottom: theme.spacing(0),
    },
    heavyPadding: {
      paddingTop: theme.spacing(0),
      paddingLeft: theme.spacing(1.5),
      paddingRight: theme.spacing(1.5),
      paddingBottom: theme.spacing(0),
    },
    drawerPaper: {
      width: expandedWidth,
      backgroundColor: theme.palette.brand.payBlack,
    },
    collapsedDrawerPaper: {
      width: collapsedWidth,
      backgroundColor: theme.palette.brand.payBlack,
      overflow: "hidden",
    },
    paper: {
      padding: theme.spacing(2),
      display: "flex",
      overflow: "hidden",
      flexDirection: "column",
    },
    drawer: {
      flexShrink: 0,
      width: expandedWidth,
    },
    collapsedDrawer: {
      width: collapsedWidth,
      flexShrink: 0,
    },
    logo: {
      width: "100%",
      height: "auto",
      padding: 0,
    },
  }))

  const classes = useStyles()
  const handleSetIsExpanded = (val) => dispatch(setIsExpanded(val))

  return (
    <Drawer
      variant="permanent"
      classes={{
        root: classes.root,
        paper: isExpanded ? classes.drawerPaper : classes.collapsedDrawerPaper,
      }}
      anchor="left"
      className={isExpanded ? classes.drawer : classes.collapsedDrawer}
    >
      {isExpanded ? (
        <Link to="/" className={css(classes.toolbarIcon, classes.heavyPadding)}>
          <Typography variant="h4" className={css(g.noUnderline, g.white)}>
            VizDiff
          </Typography>
        </Link>
      ) : (
        <Link to="/" className={css(classes.toolbarIcon, classes.lightPadding)}>
          <Typography variant="h4" className={css(g.noUnderline, g.white)}>
            V
          </Typography>
        </Link>
      )}

      <List style={{ height: "100%", paddingTop: 0 }}>
        <NavItems setIsExpanded={handleSetIsExpanded} isExpanded={isExpanded} />
      </List>
    </Drawer>
  )
}

export default NavDrawer
