import React from "react"
import { makeStyles } from "@material-ui/core/styles"

import global from "styles/global"
import productScreenshot from "assets/productScreenshot.png"

const useStyles = makeStyles((theme) => ({
  image: {
    width: "100%",
    marginTop: "auto",
    marginBottom: "auto",
    zIndex: 1,
    padding: 18,
    paddingRight: 30,
  },
}))

function WelcomeSplash() {
  const g = global()
  const classes = useStyles()

  return (
    <>
      <div className={classes.welcomeBG} />
      <div className={g.centerChildren}>
        <img src={productScreenshot} alt="VizDiff Dashboard" className={classes.image} />
      </div>
    </>
  )
}

export default WelcomeSplash
