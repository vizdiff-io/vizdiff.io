import { Grid } from "@material-ui/core"

import LoadingOverlay from "components/LoadingOverlay"

export default function ProjectDetail() {
  return (
    <div>
      <LoadingOverlay open={false} />

      <Grid container spacing={3}>
        <Grid item xs={12}>
          Project detail
        </Grid>
      </Grid>
    </div>
  )
}
