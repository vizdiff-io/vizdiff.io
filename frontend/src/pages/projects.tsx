import AddIcon from "@mui/icons-material/Add"
import CircleIcon from "@mui/icons-material/Circle"
import {
  Box,
  Button,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
} from "@mui/material"
import Link from "next/link"
import { type JSX, useState } from "react"

import { AppLayout } from "@/components/AppLayout"
import LeftSidebar from "@/components/LeftSidebar"
import NewProjectDialog from "@/components/NewProjectDialog"
import { Seo } from "@/components/Seo"
import useApiGet from "@/hooks/useApiGet"
import useAppTheme from "@/hooks/useAppTheme"
import type { ProjectResponse, ScreenshotTestResponse } from "@/lib/apiTypes"
import { getStatusColor } from "@/lib/colors"
import { plural } from "@/lib/text"
import { formatTimeAgo } from "@/lib/time"

export default function Projects(): JSX.Element {
  const [showModal, setShowModal] = useState(false)
  // Bumped when the New Project dialog closes so the list picks up a just-created project.
  // Intentionally not tied to the dialog opening: refetching on open used to flip the page
  // into its loading state and unmount the freshly-opened dialog.
  const [refreshKey, setRefreshKey] = useState(0)
  const [projectsResponse, loading, projectError] = useApiGet<ProjectResponse[]>("/api/projects", [
    refreshKey,
  ])
  const [activityResponse, activityLoading] = useApiGet<ScreenshotTestResponse[]>("/api/activity")
  const theme = useAppTheme()
  const projects = projectsResponse ?? []
  const activity = activityResponse ?? []

  // Show the full-page loading state only on the initial load; refetches keep showing the
  // stale list (with the dialog still mounted) until fresh data arrives
  if (loading && projectsResponse == undefined) {
    return (
      <>
        <Seo title="VizDiff: Projects" path="/projects"></Seo>
        <AppLayout>
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        </AppLayout>
      </>
    )
  }

  return (
    <>
      <Seo title="VizDiff: Projects" path="/projects"></Seo>
      <AppLayout>
        <Box
          sx={{
            display: "flex",
            gap: 3,
            px: { xs: 0, md: 3 },
            py: { xs: 0, md: 4 },
            minHeight: "calc(100vh - 64px)",
          }}
        >
          <LeftSidebar selectedItem="projects" />

          {/* Main Content */}
          <Box sx={{ flex: 1 }}>
            <Box
              sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}
            >
              <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
                Projects
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => setShowModal(true)}
                sx={{
                  whiteSpace: "nowrap",
                }}
              >
                Add project
              </Button>
            </Box>

            {projectError && (
              <Paper sx={{ p: 2, mb: 3, bgcolor: "error.light", color: "error.contrastText" }}>
                {projectError.message}
              </Paper>
            )}

            {projects.length === 0 ? (
              <Typography>No projects yet</Typography>
            ) : (
              <Box>
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/project?id=${project.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <Paper
                      sx={{
                        p: 3,
                        mb: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        "&:hover": { bgcolor: "action.hover", cursor: "pointer" },
                      }}
                    >
                      <Box>
                        <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                          {project.name}
                        </Typography>
                        {project.lastBuildStampSec > 0 ? (
                          <Typography variant="body2" color="var(--text-primary)">
                            Last build {formatTimeAgo(project.lastBuildStampSec * 1000)} •{" "}
                            {project.builds} Build{plural(project.builds)} • {project.tests} Test
                            {plural(project.tests)}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="var(--text-primary)">
                            No builds yet
                          </Typography>
                        )}
                      </Box>
                      <Box>{/* Add any project actions here */}</Box>
                    </Paper>
                  </Link>
                ))}
              </Box>
            )}
          </Box>

          {/* Right Activity Column */}
          <Box sx={{ width: 300, flexShrink: 0, display: { xs: "none", md: "block" } }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              ACTIVITY
            </Typography>
            <List>
              {activityLoading ? (
                <Typography variant="body2" color="var(--text-primary)" sx={{ px: 2 }}>
                  Loading activity...
                </Typography>
              ) : activity.length === 0 ? (
                <Typography variant="body2">No recent builds</Typography>
              ) : (
                activity.map((test) => (
                  <Link
                    key={test.id}
                    href={`/build?id=${test.id}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <ListItem
                      sx={{
                        px: 0,
                        py: 1,
                        overflow: "hidden",
                        "&:hover": { bgcolor: "var(--five-percent-opacity)" },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CircleIcon
                          sx={{
                            fontSize: 12,
                            color: getStatusColor(theme, test.status),
                          }}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Build #${test.buildNumber} • ${test.projectName}`}
                        secondary={
                          <>
                            {formatTimeAgo(test.initiatedStampSec * 1000)} on{" "}
                            <Typography
                              component="span"
                              variant="caption"
                              sx={{ fontFamily: "monospace" }}
                            >
                              {test.branch}
                            </Typography>
                          </>
                        }
                        slotProps={{
                          primary: {
                            variant: "body2",
                            noWrap: true,
                            sx: {
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                            },
                          },
                          secondary: {
                            variant: "caption",
                            noWrap: true,
                            sx: {
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                            },
                          },
                        }}
                      />
                    </ListItem>
                  </Link>
                ))
              )}
            </List>
          </Box>
        </Box>

        {/* New Project Modal */}
        {showModal && (
          <NewProjectDialog
            onClose={() => {
              setShowModal(false)
              // Refetch the project list after the dialog closes (a project may have been created)
              setRefreshKey((key) => key + 1)
            }}
          />
        )}
      </AppLayout>
    </>
  )
}
