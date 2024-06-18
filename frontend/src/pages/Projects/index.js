import { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useHistory } from "react-router-dom"

import TableHeader from "components/TableHeader"
import Button from "components/Button"
import DataGrid from "components/DataGrid"
import global from "styles/global"
import { getProjects, projectsSelector } from "slices/projects"
import { getRepos } from "slices/github"
import { setHeaderData } from "slices/misc"

export default function Projects() {
  const dispatch = useDispatch()
  const g = global()
  const history = useHistory()

  const { data: projects } = useSelector(projectsSelector)
  const columns = [
    {
      field: "name",
      headerName: "Name",
      flex: 2,
    },
    {
      field: "githubRepoUrl",
      headerName: "URL",
      flex: 3,
    },
  ]

  useEffect(() => {
    dispatch(getProjects())
    dispatch(getRepos())
    dispatch(
      setHeaderData({
        title: "Projects",
        breadcrumbs: [{ label: "Projects" }],
      }),
    )
  }, [])

  return (
    <div>
      <TableHeader title="Projects">
        <div>
          <Button
            size="small"
            variant="contained"
            className={g.ml_xs}
            color="primary"
            onClick={() => history.push("/projects/new")}
          >
            New Project
          </Button>
        </div>
      </TableHeader>
      <DataGrid disableSelectionOnClick autoHeight autoPageSize rows={projects} columns={columns} />
    </div>
  )
}
