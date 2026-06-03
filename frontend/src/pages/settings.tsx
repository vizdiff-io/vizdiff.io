import DeleteIcon from "@mui/icons-material/Delete"
import LinkIcon from "@mui/icons-material/Link"
import StarIcon from "@mui/icons-material/Star"
import {
  Box,
  Typography,
  Paper,
  Avatar,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  Alert,
  Link as MuiLink,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Tooltip,
  IconButton,
} from "@mui/material"
import { useRouter } from "next/router"
import { type JSX, useState } from "react"

import { AppLayout } from "@/components/AppLayout"
import LeftSidebar from "@/components/LeftSidebar"
import { Seo } from "@/components/Seo"
import useApiGet from "@/hooks/useApiGet"
import useAuth from "@/hooks/useAuth"
import { apiDelete } from "@/lib/apiMethods"
import type { ProjectResponse } from "@/lib/apiTypes"

export default function Settings(): JSX.Element {
  const { user, isLoading, error } = useAuth()
  const router = useRouter()
  const [projectsResponse, projectsLoading, projectError] =
    useApiGet<ProjectResponse[]>("/api/projects")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<ProjectResponse | null>(null)
  const [projectDeleteError, setProjectDeleteError] = useState<string | null>(null)

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const [_response, apiError] = await apiDelete<void>("/api/users/me")

      if (apiError) {
        setDeleteError(apiError.message || "Failed to delete account. Please try again.")
        setIsDeleting(false)
      } else {
        // Redirect to home page on successful deletion
        void router.push("/")
      }
    } catch (err) {
      console.error("Failed to delete account:", err)
      setDeleteError("An unexpected error occurred. Please try again.")
      setIsDeleting(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!projectToDelete) {
      return
    }

    setIsDeleting(true)
    setProjectDeleteError(null)

    try {
      const [_response, apiError] = await apiDelete<{ success: boolean }>(
        `/api/projects/${projectToDelete.id}`,
      )

      if (apiError) {
        setProjectDeleteError(apiError.message || "Failed to delete project")
      } else {
        // Reload the page to refresh the projects list
        window.location.reload()
      }
    } catch (err) {
      console.error("Failed to delete project:", err)
      setProjectDeleteError("An unexpected error occurred")
    } finally {
      setIsDeleting(false)
    }
  }

  const name = user?.displayName ?? user?.githubUsername ?? user?.email

  return (
    <>
      <Seo title="VizDiff: Settings" canonical="https://vizdiff.io/settings"></Seo>
      <AppLayout>
        <Box
          sx={{
            display: "flex",
            gap: 3,
            px: { xs: 0, sm: 3 },
            py: { xs: 1, sm: 4 },
            minHeight: "calc(100vh - 64px)",
            overflowX: "hidden",
          }}
        >
          <LeftSidebar selectedItem="settings" />

          <Box sx={{ flex: 1, width: "100%" }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 4 }}>
              Account Settings
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error.message}
              </Alert>
            )}

            {isLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : user ? (
              <>
                <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
                    <Avatar
                      src={user.githubProfile?.avatar_url}
                      alt={name ?? "User"}
                      sx={{ width: 64, height: 64, mr: 3 }}
                    />
                    <Box>
                      <Typography variant="h6">{name}</Typography>
                      <Typography variant="body2" color="var(--text-secondary)">
                        {user.email ?? "No email available"}
                      </Typography>
                    </Box>
                  </Box>

                  {user.githubUsername && (
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        variant="subtitle2"
                        color="var(--text-secondary)"
                        sx={{ mb: 0.5 }}
                      >
                        GitHub Username
                      </Typography>
                      <Typography variant="body1">{user.githubUsername}</Typography>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="subtitle2" color="var(--text-secondary)" sx={{ mb: 0.5 }}>
                      Account Created
                    </Typography>
                    <Typography variant="body1">
                      {new Date(user.createdStampSec * 1000).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Paper>

                <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: { xs: 0, sm: 2 },
                    }}
                  >
                    <Typography variant="h6">Projects</Typography>
                  </Box>

                  {projectsLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                      <CircularProgress />
                    </Box>
                  ) : projectError ? (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      Failed to load projects: {projectError.message}
                    </Alert>
                  ) : !projectsResponse?.length ? (
                    <Typography variant="body2" color="var(--text-secondary)" sx={{ py: 2 }}>
                      No projects found. Upload your first Storybook build from GitLab CI to create
                      a project.
                    </Typography>
                  ) : (
                    <List>
                      {projectsResponse.map((project) => (
                        <Box key={project.id}>
                          <ListItem
                            sx={{ p: { xs: 0, sm: "8px 48px 8px 16px" } }}
                            secondaryAction={
                              project.ownerId === user.id && (
                                <Tooltip title="Delete project">
                                  <IconButton
                                    edge="end"
                                    aria-label="delete"
                                    onClick={() => {
                                      setProjectToDelete(project)
                                      setProjectDeleteError(null)
                                    }}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Tooltip>
                              )
                            }
                          >
                            <ListItemIcon sx={{ minWidth: "38px" }}>
                              {project.ownerId === user.id ? (
                                <StarIcon color="primary" />
                              ) : (
                                <LinkIcon color="action" />
                              )}
                            </ListItemIcon>
                            <ListItemText
                              primary={project.name}
                              secondary={
                                <Box
                                  component="span"
                                  sx={{ display: "flex", flexDirection: "column" }}
                                >
                                  <Typography variant="body2" component="span">
                                    {project.ownerId === user.id ? "Owner" : ""}
                                  </Typography>
                                  <MuiLink
                                    href={project.repoUrl}
                                    target="_blank"
                                    rel="noopener"
                                    variant="body2"
                                    sx={{
                                      color: "var(--text-secondary)",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      direction: "rtl",
                                      textAlign: "left",
                                    }}
                                  >
                                    {project.repoUrl.replace(/^https?:\/\/[^/]+\//, "")}
                                  </MuiLink>
                                </Box>
                              }
                            />
                            <Typography
                              variant="body2"
                              color="var(--text-secondary)"
                              sx={{ display: { xs: "none", sm: "block" } }}
                            >
                              {project.builds} build{project.builds === 1 ? "" : "s"} ·{" "}
                              {project.tests} test{project.tests === 1 ? "" : "s"}
                            </Typography>
                          </ListItem>
                          <Divider variant="inset" component="li" />
                        </Box>
                      ))}
                    </List>
                  )}
                </Paper>

                <Box sx={{ maxWidth: "500px" }}>
                  <Paper
                    sx={{
                      p: 3,
                      mb: 4,
                      borderLeft: "4px solid",
                      borderColor: "error.main",
                    }}
                  >
                    <Typography variant="h6" sx={{ mb: 2, color: "error.light" }}>
                      Danger Zone
                    </Typography>
                    <Typography sx={{ mb: 2 }}>
                      Deleting your account will permanently remove all your data, including
                      projects, builds, screenshots, and settings. This action cannot be undone.
                    </Typography>
                    <Button
                      variant="contained"
                      color="error"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      Delete Account
                    </Button>
                  </Paper>
                </Box>
              </>
            ) : (
              <Typography>No user information available.</Typography>
            )}
          </Box>
        </Box>

        {/* Project Delete Confirmation Dialog */}
        <Dialog
          open={projectToDelete != null}
          onClose={() => !isDeleting && setProjectToDelete(null)}
        >
          <DialogTitle>Delete Project?</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: "var(--text-primary)" }}>
              Are you sure you want to delete project &ldquo;{projectToDelete?.name}&rdquo;? This
              action cannot be undone. All builds, screenshots, and test results will be permanently
              deleted.
            </DialogContentText>
            {projectDeleteError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {projectDeleteError}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setProjectToDelete(null)} disabled={isDeleting} color="primary">
              Cancel
            </Button>
            <Button
              onClick={handleDeleteProject}
              color="error"
              disabled={isDeleting}
              variant="contained"
              startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {isDeleting ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Account Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => !isDeleting && setDeleteDialogOpen(false)}>
          <DialogTitle>Delete Your Account?</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: "var(--text-primary)" }}>
              This action cannot be undone. All your data, including projects, builds, screenshots,
              and settings will be permanently deleted. Are you sure you want to delete your
              account?
            </DialogContentText>
            {deleteError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {deleteError}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
              color="primary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteAccount}
              color="error"
              disabled={isDeleting}
              variant="contained"
              startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {isDeleting ? "Deleting..." : "Delete Account"}
            </Button>
          </DialogActions>
        </Dialog>
      </AppLayout>
    </>
  )
}
