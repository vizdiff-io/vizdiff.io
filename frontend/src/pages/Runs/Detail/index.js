import { useState, useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useParams } from "react-router-dom"
import { Grid } from "@material-ui/core"

import { setHeaderData } from "slices/misc"
import LoadingOverlay from "components/LoadingOverlay"
import Card from "components/Card"
import KeyValuePair from "components/KeyValuePair"
import DataGrid from "components/DataGrid"
import Button from "components/Button"
import TableHeader from "components/TableHeader"
import ModalApproveTestResult from "components/ModalApproveTestResult"
import { getRuns } from "slices/runs"
import { runWithNameSelector } from "slices/multiSliceSelectors"
import { getProjects } from "slices/projects"
import { getTestResults, updateTestResult, testResultsSelector } from "slices/testResults"
import global from "styles/global"

export default function RunDetail() {
  const g = global()
  const dispatch = useDispatch()
  const { runId } = useParams()
  const [selectionModel, setSelectionModel] = useState([])
  const [activeTest, setActiveTest] = useState(null)
  const columns = [
    {
      field: "id",
      headerName: "Id",
      flex: 1,
    },
    {
      field: "launchModal",
      headerName: "View diff",
      flex: 1,
      renderCell: (params) => (
        <Button size="small" color="primary" onClick={() => setActiveTest(params.row)}>
          View diff
        </Button>
      ),
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
    {
      field: "changeStatus",
      headerName: "Change Status",
      flex: 1,
    },
  ]

  const handleSelectionModelChange = (selection) => {
    setSelectionModel(selection)
  }

  const handleApprove = async () => {
    const updatedTestResults = selectionModel.map((id) => ({
      id,
      changeStatus: "approved",
    }))
    Promise.all(updatedTestResults.map((testResult) => dispatch(updateTestResult(testResult))))
  }

  const handleCloseModal = () => {
    setActiveTest(null)
  }

  const handleNextTest = () => {
    // set the active test to the next
    const testOptions = testResultsState.data.filter(
      (test) =>
        test.changeStatus !== "approved" &&
        test.changeStatus !== "no_change" &&
        test.id !== activeTest.id,
    )
    const nextTest = testOptions[0]
    if (nextTest) setActiveTest(nextTest)
    else handleCloseModal()
  }

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
  }, [dispatch, runId])

  const run = useSelector((state) => runWithNameSelector(state, runId))
  const testResultsState = useSelector(testResultsSelector)

  return (
    <div>
      <LoadingOverlay open={false} />
      <ModalApproveTestResult
        open={!!activeTest}
        callback={() =>
          dispatch(updateTestResult({ id: activeTest?.id, changeStatus: "approved" }))
        }
        testResult={activeTest}
        handleClose={handleCloseModal}
        handleNextTest={handleNextTest}
      />
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
          <TableHeader title="Screenshot Results">
            <div>
              <Button
                size="small"
                variant="contained"
                className={g.ml_xs}
                color="primary"
                disabled={selectionModel.length === 0}
                onClick={handleApprove}
              >
                Approve
              </Button>
            </div>
          </TableHeader>

          <DataGrid
            autoHeight
            rows={testResultsState.data}
            columns={columns}
            checkboxSelection
            onSelectionModelChange={handleSelectionModelChange}
            selectionModel={selectionModel}
            isRowSelectable={({ row }) =>
              row.changeStatus !== "approved" && row.changeStatus !== "no_change"
            }
            disableSelectionOnClick
          />
        </Grid>
      </Grid>
    </div>
  )
}
