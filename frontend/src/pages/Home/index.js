import React, { useEffect } from "react"
import { useDispatch } from "react-redux"
import { Grid } from "@material-ui/core"

import LoadingOverlay from "components/LoadingOverlay"
import { setHeaderData } from "slices/misc"

export default function Home() {
  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(
      setHeaderData({
        title: "Home",
        breadcrumbs: [{ label: "VizDiff" }],
      }),
    )
  }, [dispatch])

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
