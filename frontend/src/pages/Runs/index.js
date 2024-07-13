import { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useHistory } from "react-router-dom"

import TableHeader from "components/TableHeader"
import Button from "components/Button"
import DataGrid from "components/DataGrid"
import global from "styles/global"
import { getRuns } from "slices/runs"
import { getProjects } from "slices/projects"
import { runsWithNameSelector } from "slices/multiSliceSelectors"
import { setHeaderData } from "slices/misc"

export default function Runs() {
  const dispatch = useDispatch()
  const g = global()
  const history = useHistory()

  const runs = useSelector(runsWithNameSelector)
  const columns = [
    {
      field: "projectName",
      headerName: "Repo Name",
      flex: 1,
      renderCell: (params) => (
        <Button size="small" color="primary" onClick={() => history.push(`/runs/${params.row.id}`)}>
          {params.row.projectName}
        </Button>
      ),
    },
    {
      field: "branch",
      headerName: "Branch",
      flex: 1,
    },
    {
      field: "commitSha",
      headerName: "Commit SHA",
      flex: 1,
    },
  ]

  useEffect(() => {
    dispatch(getRuns())
    dispatch(getProjects())
    dispatch(
      setHeaderData({
        title: "Runs",
        breadcrumbs: [{ label: "Runs" }],
      }),
    )
  }, [dispatch])

  return (
    <div>
      <TableHeader title="Runs">
        <div>
          <Button
            size="small"
            variant="contained"
            className={g.ml_xs}
            color="primary"
            onClick={() => history.push("/runs/new")}
          >
            New Run
          </Button>
        </div>
      </TableHeader>
      <DataGrid disableSelectionOnClick autoHeight autoPageSize rows={runs} columns={columns} />
    </div>
  )
}
