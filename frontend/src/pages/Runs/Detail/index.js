import { Grid } from "@material-ui/core"

import LoadingOverlay from "components/LoadingOverlay"

export default function RunDetail() {
  return (
    <div>
      <LoadingOverlay open={false} />

      <Grid container spacing={3}>
        <Grid item xs={12}>
          run detail
        </Grid>
      </Grid>
    </div>
  )
}
