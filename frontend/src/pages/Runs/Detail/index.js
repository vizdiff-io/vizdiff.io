import { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useParams } from "react-router-dom"
import { Grid } from "@material-ui/core"

import { setHeaderData } from "slices/misc"
import LoadingOverlay from "components/LoadingOverlay"
import Card from "components/Card"
import KeyValuePair from "components/KeyValuePair"
import Button from "components/Button"
import DataGrid from "components/DataGrid"
import { getRuns } from "slices/runs"
import { runWithNameSelector } from "slices/multiSliceSelectors"
import { getProjects } from "slices/projects"
import { getTestResults, testResultsSelector } from "slices/testResults"

export default function RunDetail() {
  const dispatch = useDispatch()
  const { runId } = useParams()
  const columns = [
    {
      field: "id",
      headerName: "Id",
      flex: 1,
    },
    {
      field: "newImageUrl",
      headerName: "newImageUrl",
      flex: 1,
    },
    {
      field: "diffImageUrl",
      headerName: "diffImageUrl",
      flex: 1,
    },
  ]
  useEffect(() => {
    dispatch(getRuns())
    dispatch(getProjects())
    dispatch(getTestResults(runId))
    dispatch(
      setHeaderData({
        title: "Runs",
        breadcrumbs: [{ label: "Runs", to: "/runs" }, { label: "Run Detail" }],
      }),
    )
  }, [dispatch])

  const run = useSelector((state) => runWithNameSelector(state, runId))
  const testResultsState = useSelector(testResultsSelector)

  return (
    <div>
      <LoadingOverlay open={false} />
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card title="Run Details">
            <KeyValuePair label="Repo Name" value={run.projectName} />
            <KeyValuePair label="Branch" value={run.branch} />
            <KeyValuePair label="Commit SHA" value={run.commitSha} />
            <KeyValuePair label="Status" value={run.status} />
            <KeyValuePair label="Created At" value={run.createdAt} />
            <KeyValuePair label="Updated At" value={run.updatedAt} />
          </Card>
        </Grid>

        <Grid item xs={12}>
          <DataGrid autoHeight rows={testResultsState.data} columns={columns} />
        </Grid>
      </Grid>
    </div>
  )
}
