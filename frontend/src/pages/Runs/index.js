import { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useHistory } from "react-router-dom"

import TableHeader from "components/TableHeader"
import Button from "components/Button"
import DataGrid from "components/DataGrid"
import global from "styles/global"
import { getRuns, runsSelector } from "slices/runs"
import { setHeaderData } from "slices/misc"

export default function Runs() {
  const dispatch = useDispatch()
  const g = global()
  const history = useHistory()

  const { data: runs } = useSelector(runsSelector)
  const columns = [
    {
      field: "repoName",
      headerName: "Repo Name",
      flex: 1,
      renderCell: (params) => (
        <Button size="small" color="primary" onClick={() => history.push(`/runs/${params.row.id}`)}>
          {params.row.repoName}
        </Button>
      ),
    },
    {
      field: "branch",
      headerName: "Branch",
      flex: 1,
    },
  ]

  useEffect(() => {
    dispatch(getRuns())
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
