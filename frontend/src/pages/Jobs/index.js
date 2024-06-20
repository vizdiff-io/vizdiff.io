import { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useHistory } from "react-router-dom"

import TableHeader from "components/TableHeader"
import Button from "components/Button"
import DataGrid from "components/DataGrid"
import global from "styles/global"
import { getJobs, jobsSelector } from "slices/jobs"
import { setHeaderData } from "slices/misc"

export default function Jobs() {
  const dispatch = useDispatch()
  const g = global()
  const history = useHistory()

  const { data: jobs } = useSelector(jobsSelector)
  const columns = [
    {
      field: "repoName",
      headerName: "Repo Name",
      flex: 1,
      renderCell: (params) => (
        <Button size="small" color="primary" onClick={() => history.push(`/jobs/${params.row.id}`)}>
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
    dispatch(getJobs())
    dispatch(
      setHeaderData({
        title: "Jobs",
        breadcrumbs: [{ label: "Jobs" }],
      }),
    )
  }, [dispatch])

  return (
    <div>
      <TableHeader title="Jobs">
        <div>
          <Button
            size="small"
            variant="contained"
            className={g.ml_xs}
            color="primary"
            onClick={() => history.push("/jobs/new")}
          >
            New Job
          </Button>
        </div>
      </TableHeader>
      <DataGrid disableSelectionOnClick autoHeight autoPageSize rows={jobs} columns={columns} />
    </div>
  )
}
