import { useEffect, useMemo, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useHistory } from "react-router-dom"
import { Typography } from "@material-ui/core"
import css from "classnames"
import global from "styles/global"

import LoadingOverlay from "components/LoadingOverlay"
import RadioDescription from "components/RadioDescription"
import Button from "components/Button"
import DataGrid from "components/DataGrid"
import TableHeader from "components/TableHeader"
import { setHeaderData } from "slices/misc"
import {
  createProject,
  createProjectSelector,
  getProjects,
  projectsSetSelector,
} from "slices/projects"
import { getRepos, reposSelector, getOrgs, orgsSelector } from "slices/github"

export default function NewProject() {
  const g = global()
  const history = useHistory()
  const [selectedSource, setSelectedSource] = useState("me")
  const dispatch = useDispatch()
  const { loading: isSubmitting } = useSelector(createProjectSelector)

  const refreshData = () => {
    dispatch(getOrgs())
    dispatch(getRepos())
    dispatch(getProjects())
  }

  const { data: repos, loading } = useSelector(reposSelector)
  const { data: orgs } = useSelector(orgsSelector)
  const projectsSet = useSelector(projectsSetSelector)

  const columns = [
    {
      field: "name",
      headerName: "Name",
      flex: 2,
    },
    {
      field: " ",
      headerName: "",
      flex: 1,
      sortable: false,
      renderCell: (params) => {
        const isDisabled = projectsSet.has(params.row.html_url)
        return (
          <Button
            size="small"
            variant="contained"
            className={css(g.ml_xs, isDisabled && g.disabled)}
            color="primary"
            onClick={() => {
              handleCreate({
                name: params.row.name,
                githubRepoUrl: params.row.html_url,
              })
            }}
            disabled={isDisabled}
          >
            Create Project
          </Button>
        )
      },
    },
  ]

  useEffect(() => {
    dispatch(
      setHeaderData({
        title: "New Project",
        breadcrumbs: [{ label: "Projects", link: "/projects" }, { label: "New" }],
      }),
    )
    refreshData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedSource && !loading) {
      if (selectedSource === "me") {
        dispatch(getRepos())
      } else {
        dispatch(getRepos({ org: selectedSource }))
      }
    }
  }, [selectedSource, orgs, dispatch, loading])

  const handleCreate = async (data) => {
    await dispatch(createProject(data))
    history.push("/projects")
  }

  const sourceOptions = useMemo(() => {
    const options = [{ title: "My Repos", value: "me" }]
    options.push(...orgs.map((org) => ({ title: org.login, value: org.login })))
    return options
  }, [orgs])

  return (
    <div>
      {isSubmitting && <LoadingOverlay />}
      <Typography variant="h3">Select a Repo source</Typography>
      <RadioDescription
        value={selectedSource}
        setValue={setSelectedSource}
        options={sourceOptions}
      />
      <div className={g.mb_xl}></div>
      <TableHeader title="Available Repos" subtitle="Select a Repo to create a Project" />
      <DataGrid disableSelectionOnClick autoHeight autoPageSize rows={repos} columns={columns} />
    </div>
  )
}
