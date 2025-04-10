import CloseIcon from "@mui/icons-material/Close"
import GitHubIcon from "@mui/icons-material/GitHub"
import RefreshIcon from "@mui/icons-material/Refresh"
import {
  List,
  ListItemButton,
  ListItemText,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Typography,
  Box,
} from "@mui/material"
import type { Endpoints } from "@octokit/types"
import React, { useState, useEffect, useCallback } from "react"

import useAuthenticatedFetch from "@/hooks/useApiGet"
import { apiGet, apiPost } from "@/lib/apiMethods"
import { GITHUB_APP_NAME } from "@/lib/environment"

type NewProjectDialogProps = {
  onClose: () => void
  initialSelectedOrg?: string
}

type GithubOrg = Endpoints["GET /user/orgs"]["response"]["data"][0]
type GithubRepo = Endpoints["GET /orgs/{org}/repos"]["response"]["data"][0]

const API_ORGS_URL = "/api/github/orgs"
const API_REPOS_URL = "/api/github/repos"

export default function NewProjectDialog({
  onClose,
  initialSelectedOrg,
}: NewProjectDialogProps): JSX.Element {
  const [repos, setRepos] = useState<GithubRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [_error, setError] = useState<string | null>(null)
  const [_selectedOrg, setSelectedOrg] = useState<string | undefined>(initialSelectedOrg)
  const [reposLoading, setReposLoading] = useState(false)
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null)

  const [orgs, isOrgsLoading, _orgsErr] = useAuthenticatedFetch<GithubOrg[]>(
    API_ORGS_URL + `?refresh=${refreshCounter}`,
  )

  useEffect(() => {
    if (isOrgsLoading && loadingStartTime == null) {
      setLoadingStartTime(Date.now())
    } else if (!isOrgsLoading && loadingStartTime != null) {
      const elapsedTime = Date.now() - loadingStartTime
      if (elapsedTime < MIN_LOADING_TIME) {
        const timeout = setTimeout(() => {
          setLoadingStartTime(null)
        }, MIN_LOADING_TIME - elapsedTime)
        return () => clearTimeout(timeout)
      }
      setLoadingStartTime(null)
    }
    return undefined
  }, [isOrgsLoading, loadingStartTime])

  const updateLoading = useCallback(() => {
    if (!isOrgsLoading && loadingStartTime == null) {
      setLoading(false)
    }
  }, [isOrgsLoading, loadingStartTime])

  const handleOrgClick = useCallback(async (org: string) => {
    setReposLoading(true)
    const loadStart = Date.now()
    const [orgRepos, _orgReposError] = await apiGet(`${API_REPOS_URL}?org=${org}`)
    setRepos((orgRepos as [] | null) ?? [])
    setSelectedOrg(org)

    const elapsedTime = Date.now() - loadStart
    if (elapsedTime < MIN_LOADING_TIME) {
      await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_TIME - elapsedTime))
    }
    setReposLoading(false)
  }, [])

  useEffect(() => updateLoading(), [updateLoading])

  // Fetch repos for initialSelectedOrg when orgs are loaded
  useEffect(() => {
    if (initialSelectedOrg && orgs && orgs.length > 0 && !isOrgsLoading) {
      void handleOrgClick(initialSelectedOrg)
    }
  }, [initialSelectedOrg, orgs, isOrgsLoading, handleOrgClick])

  const handleRefresh = useCallback(() => {
    setLoading(true)
    setReposLoading(false)
    setRepos([])
    setSelectedOrg(undefined)
    setLoadingStartTime(Date.now())
    setRefreshCounter((prev) => prev + 1)
  }, [])

  const handleRepoClick = async (repo: GithubRepo) => {
    setLoading(true)
    setLoadingStartTime(Date.now())
    // Create the project
    const [_project, projectError] = await apiPost("/api/projects", {
      name: repo.name,
      githubRepoUrl: repo.html_url,
    })
    updateLoading()
    if (projectError) {
      setError(projectError.message)
    }
    onClose()
  }

  const handleInstallApp = () => {
    const installUrl = `https://github.com/apps/${GITHUB_APP_NAME}/installations/new`
    window.open(installUrl, "_blank")
  }

  // Define a minimum loading time (in ms) to ensure loading states are visible
  const MIN_LOADING_TIME = 300

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: "50vh",
          maxHeight: "80vh",
        },
      }}
    >
      <DialogTitle
        sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 2 }}
      >
        Add GitHub Repository
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {!isOrgsLoading && !loading && loadingStartTime == null && orgs && orgs.length > 0 && (
            <Button
              size="small"
              variant="outlined"
              onClick={handleInstallApp}
              startIcon={<GitHubIcon />}
              sx={{
                height: "32px",
                textTransform: "none",
                color: "black",
                borderColor: "rgba(0, 0, 0, 0.23)",
                "& .MuiSvgIcon-root": {
                  color: "black",
                },
                "&:hover": {
                  borderColor: "rgba(0, 0, 0, 0.5)",
                  backgroundColor: "rgba(0, 0, 0, 0.04)",
                },
              }}
            >
              Configure GitHub App
            </Button>
          )}
          <IconButton onClick={handleRefresh} size="small" title="Refresh organizations">
            <RefreshIcon />
          </IconButton>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </div>
      </DialogTitle>
      <DialogContent>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "stretch",
            gap: "1rem",
            height: "100%",
            minHeight: "300px",
            transition: "opacity 0.2s ease-in-out",
          }}
        >
          {loading || isOrgsLoading || loadingStartTime != null ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                width: "100%",
                opacity: 1,
                transition: "opacity 0.2s ease-in-out",
              }}
            >
              <CircularProgress />
            </div>
          ) : (
            <>
              <div style={{ width: "49%" }}>
                <h4>Organizations</h4>
                {orgs?.length === 0 ? (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      p: 3,
                      gap: 2,
                    }}
                  >
                    <Typography>
                      Install the vizdiff GitHub App to enable screenshot testing for your
                      repositories.
                    </Typography>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={handleInstallApp}
                      startIcon={<GitHubIcon />}
                      sx={{
                        bgcolor: "white",
                        color: "black",
                        "&:hover": {
                          bgcolor: "#f5f5f5",
                        },
                        boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                      }}
                    >
                      Install GitHub App
                    </Button>
                  </Box>
                ) : (
                  <List
                    component="nav"
                    sx={{
                      overflowY: "scroll",
                      maxHeight: "60vh",
                    }}
                  >
                    {orgs?.map((org) => (
                      <ListItemButton key={org.id} onClick={() => handleOrgClick(org.login)}>
                        <ListItemText primary={org.login} />
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </div>
              <div
                style={{
                  borderLeft: "1px solid",
                  borderColor: "divider",
                  opacity: 0.3,
                  flexGrow: 1,
                }}
              />
              <div style={{ width: "50%", paddingLeft: "1rem" }}>
                <h4>Repositories</h4>
                {reposLoading ? (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      height: "100%",
                    }}
                  >
                    <CircularProgress />
                  </div>
                ) : (
                  repos.length > 0 && (
                    <List
                      component="nav"
                      sx={{
                        overflowY: "scroll",
                        maxHeight: "60vh",
                      }}
                    >
                      {repos.map((repo) => (
                        <ListItemButton key={repo.id} onClick={() => handleRepoClick(repo)}>
                          <ListItemText primary={repo.name} />
                        </ListItemButton>
                      ))}
                    </List>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
