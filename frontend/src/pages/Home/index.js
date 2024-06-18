import React, { useEffect, useState } from "react"
import { useDispatch, connect } from "react-redux"
import { Grid } from "@material-ui/core"

import LoadingOverlay from "components/LoadingOverlay"
import global from "styles/global"
import { setHeaderData } from "slices/misc"

function Home() {
  const dispatch = useDispatch()
  const g = global()

  useEffect(() => {
    dispatch(
      setHeaderData({
        title: "Home",
        breadcrumbs: [{ label: "VizDiff" }],
      }),
    )
  }, [])

  return (
    <div>
      <LoadingOverlay open={false} />

      <Grid container spacing={3}>
        <Grid item xs={12}>
          VizDiff
        </Grid>
      </Grid>
    </div>
  )
}

const mapStateToProps = (state) => ({})

const mapDispatchToProps = (dispatch) => ({})

export default connect(mapStateToProps, mapDispatchToProps)(Home)
