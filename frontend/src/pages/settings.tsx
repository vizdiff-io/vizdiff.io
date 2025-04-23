import DeleteIcon from "@mui/icons-material/Delete"
import LinkIcon from "@mui/icons-material/Link"
import RefreshIcon from "@mui/icons-material/Refresh"
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Tooltip,
  IconButton,
} from "@mui/material"
import Head from "next/head"
import { useRouter } from "next/router"
import { useMemo, useState } from "react"

import { AppLayout } from "@/components/AppLayout"
import useApiGet from "@/hooks/useApiGet"
import useAuth from "@/hooks/useAuth"
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"
import { apiDelete, apiPost } from "@/lib/apiMethods"
import type { ProjectResponse } from "@/lib/apiTypes"

export default function Settings(): JSX.Element {
  const { user, isLoading, error } = useAuth()
  const router = useRouter()
  const [projectsResponse, projectsLoading, projectError] =
    useApiGet<ProjectResponse[]>("/api/projects")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<ProjectResponse | null>(null)
  const [projectDeleteError, setProjectDeleteError] = useState<string | null>(null)

  const handleSyncRepos = async () => {
    setIsSyncing(true)
    setSyncError(null)

    try {
      const [_response, apiError] = await apiPost<{ message: string; count: number }>(
        "/api/sync-github-repos",
        {},
      )

      if (apiError) {
        setSyncError(apiError.message || "Failed to sync GitHub repositories")
      } else {
        // Refresh projects list
        window.location.reload()
      }
    } catch (err) {
      console.error("Failed to sync GitHub repositories:", err)
      setSyncError("An unexpected error occurred during sync")
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    setDeleteError(null)

    try {
      // Use beacon transport since we redirect immediately after success
      trackEvent(
        { action: AnalyticsEvents.DELETE_ACCOUNT, category: "Settings" },
        { sendBeforeNavigation: true },
      )
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

  const name = user?.githubProfile.name ?? user?.githubUsername

  // Describe the user's subscription or trial status
  const subscriptionInfo = useMemo(() => {
    if (!user) {
      return "Loading…"
    }
    if (user.subscription) {
      return `✅ ${sentenceCase(user.subscription.plan)} (${user.subscription.interval})`
    } else if (user.ownedProjectCount === 0) {
      return "Free plan"
    }
    // Check if the user's trial is over
    const trialEnd = new Date(user.trialEndStampSec * 1000)
    const now = new Date()
    if (trialEnd < now) {
      return "⚠️ Trial period has ended. Choose a plan to continue screenshot testing."
    }
    const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return `Trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
  }, [user])

  return (
    <>
      <Head>
        <title>Settings - vizdiff.io</title>
        <meta name="description" content="User account settings" />
      </Head>
      <AppLayout>
        <Box sx={{ px: 3, py: 4 }}>
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
              <Paper sx={{ p: 3, mb: 4 }}>
                <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
                  <Avatar
                    src={user.githubProfile.avatar_url}
                    alt={name}
                    sx={{ width: 64, height: 64, mr: 3 }}
                  />
                  <Box>
                    <Typography variant="h6">{name}</Typography>
                    <Typography variant="body2" color="var(--text-secondary)">
                      {user.email ?? "No email available"}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="var(--text-secondary)" sx={{ mb: 0.5 }}>
                    GitHub Username
                  </Typography>
                  <Typography variant="body1">{user.githubUsername}</Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="var(--text-secondary)" sx={{ mb: 0.5 }}>
                    Subscription Plan
                  </Typography>
                  <Typography variant="body1">{subscriptionInfo}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="var(--text-secondary)" sx={{ mb: 0.5 }}>
                    Account Created
                  </Typography>
                  <Typography variant="body1">
                    {new Date(user.createdStampSec * 1000).toLocaleDateString()}
                  </Typography>
                </Box>
              </Paper>

              <Paper sx={{ p: 3, mb: 4 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                  }}
                >
                  <Typography variant="h6">Projects</Typography>
                  <Tooltip title="Sync GitHub repositories">
                    <IconButton onClick={handleSyncRepos} disabled={isSyncing} color="primary">
                      {isSyncing ? <CircularProgress size={24} /> : <RefreshIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>

                {syncError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {syncError}
                  </Alert>
                )}

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
                    No projects found. Create a project to start testing.
                  </Typography>
                ) : (
                  <List>
                    {projectsResponse.map((project) => (
                      <Box key={project.id}>
                        <ListItem
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
                          <ListItemIcon>
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
                                  {project.ownerId === user.id ? "Owner" : "Access via GitHub"}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  component="span"
                                  color="var(--text-secondary)"
                                >
                                  {project.githubRepoUrl}
                                </Typography>
                              </Box>
                            }
                          />
                          <Typography variant="body2" color="var(--text-secondary)">
                            {project.builds} builds · {project.tests} tests
                          </Typography>
                        </ListItem>
                        <Divider variant="inset" component="li" />
                      </Box>
                    ))}
                  </List>
                )}
              </Paper>

              <Box sx={{ maxWidth: "66%" }}>
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
                    Deleting your account will permanently remove all your data, including projects,
                    builds, screenshots, and settings. This action cannot be undone.
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

function sentenceCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
