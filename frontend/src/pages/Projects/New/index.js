import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useHistory } from "react-router-dom"
import { Grid, Typography } from "@material-ui/core"
import css from "classnames"
import global from "styles/global"

import Button from "components/Button"
import TextField from "components/TextFieldDark"
import { setHeaderData } from "slices/misc"
import { createProject, createProjectSelector } from "slices/projects"
import { getRepos, reposSelector, getOrgs, orgsSelector } from "slices/github"
import { getMe, meSelector } from "slices/users"

export default function NewProject() {
  const g = global()
  const history = useHistory()
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const dispatch = useDispatch()
  const { loading: isSubmitting } = useSelector(createProjectSelector)

  const refreshData = () => {
    dispatch(getRepos())
    dispatch(getOrgs())
    dispatch(getMe())
  }

  const me = useSelector(meSelector)
  const repos = useSelector(reposSelector)
  const orgs = useSelector(orgsSelector)

  useEffect(() => {
    dispatch(
      setHeaderData({
        title: "New Project",
        breadcrumbs: [{ label: "Projects", link: "/projects" }, { label: "New" }],
      }),
    )
    refreshData()
  }, [])

  const handleCreate = async () => {
    await dispatch(
      createProject({
        name,
        address,
      }),
    )

    history.push("/projects")
  }

  const isInputInvalid = !name || !address

  return (
    <Grid container spacing={2} className={g.full_width}>
      <Grid item xs={12}>
        <Typography variant="h3">New Project</Typography>
      </Grid>
      <Grid item xs={12}>
        <TextField
          InputLabelProps={{
            shrink: true,
          }}
          fullWidth
          type="text"
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Grid>

      <Grid item xs={12}>
        <TextField
          InputLabelProps={{
            shrink: true,
          }}
          fullWidth
          type="text"
          label="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </Grid>

      <Grid item xs={12}>
        <div className={css(g.flexRowEnd)}>
          <Button
            onClick={handleCreate}
            loading={isSubmitting}
            type="submit"
            variant="contained"
            color="primary"
            disabled={isInputInvalid}
          >
            Create
          </Button>
        </div>
      </Grid>
    </Grid>
  )
}
