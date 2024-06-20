import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { Grid, Typography } from "@material-ui/core"

import LoadingOverlay from "components/LoadingOverlay"
import Autocomplete from "components/Autocomplete"
import { setHeaderData } from "slices/misc"
import { getProjects, projectsSelector } from "slices/projects"

export default function NewJob() {
  const dispatch = useDispatch()
  const { data: projects } = useSelector(projectsSelector)
  const [selectedProject, setSelectedProject] = useState(null)
  useEffect(() => {
    dispatch(
      setHeaderData({
        title: "Jobs",
        breadcrumbs: [{ label: "Jobs", link: "/jobs" }, { label: "New" }],
      }),
    )
    dispatch(getProjects())
  }, [dispatch])

  return (
    <div>
      <LoadingOverlay open={false} />

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h5">New Job</Typography>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Autocomplete
            options={projects}
            getOptionSelected={(option, value) => option.id === value.id}
            getOptionLabel={(option) => option.name}
            onChange={(_, value) => setSelectedProject(value)}
            value={selectedProject}
            textInputProps={{
              label: "Project",
            }}
          />
        </Grid>

        {/* spacer */}
        <Grid item xs={12} sm={6} />

        <Grid item xs={12} sm={6}>
          <Autocomplete
            options={[]}
            getOptionLabel={(option) => option.name}
            textInputProps={{
              label: "Branch",
            }}
          />
        </Grid>
      </Grid>
    </div>
  )
}
