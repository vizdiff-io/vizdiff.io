import CloseIcon from "@mui/icons-material/Close"
import {
  List,
  ListItemButton,
  ListItemText,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
} from "@mui/material"
import type { Endpoints } from "@octokit/types"
import React, { useState, useEffect, useCallback } from "react"

import useAuthenticatedFetch from "@/hooks/useApiGet"
import { apiGet, apiPost } from "@/lib/apiMethods"

type NewProjectDialogProps = {
  onClose: () => void
}

type GithubOrg = Endpoints["GET /user/orgs"]["response"]["data"][0]
type GithubRepo = Endpoints["GET /orgs/{org}/repos"]["response"]["data"][0]

const API_ORGS_URL = "/api/github/orgs"
const API_REPOS_URL = "/api/github/repos"

export default function NewProjectDialog({ onClose }: NewProjectDialogProps): JSX.Element {
  const [repos, setRepos] = useState<GithubRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [_error, setError] = useState<string | null>(null)

  const [orgs, isOrgsLoading, _orgsErr] = useAuthenticatedFetch<GithubOrg[]>(API_ORGS_URL)

  const updateLoading = useCallback(() => {
    if (!isOrgsLoading) {
      setLoading(false)
    }
  }, [isOrgsLoading])

  useEffect(() => updateLoading(), [updateLoading])

  const handleOrgClick = async (org: string) => {
    setLoading(true)
    const [orgRepos, _orgReposError] = await apiGet(`${API_REPOS_URL}?org=${org}`)
    setRepos((orgRepos as [] | null) ?? [])
    updateLoading()
  }

  const handleRepoClick = async (repo: GithubRepo) => {
    setLoading(true)
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
        sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}
      >
        Add Project
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: "1rem",
            height: "100%",
            minHeight: "300px",
          }}
        >
          {loading || isOrgsLoading ? (
            <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
              <CircularProgress />
            </div>
          ) : (
            <>
              <List
                component="nav"
                sx={{
                  width: "50%",
                  borderRight: 1,
                  borderColor: "divider",
                  overflowY: "auto",
                  maxHeight: "60vh",
                }}
              >
                {orgs?.map((org) => (
                  <ListItemButton key={org.id} onClick={() => handleOrgClick(org.login)}>
                    <ListItemText primary={org.login} />
                  </ListItemButton>
                ))}
              </List>
              {repos.length > 0 && (
                <List
                  component="nav"
                  sx={{
                    width: "50%",
                    overflowY: "auto",
                    maxHeight: "60vh",
                  }}
                >
                  {repos.map((repo) => (
                    <ListItemButton key={repo.id} onClick={() => handleRepoClick(repo)}>
                      <ListItemText primary={repo.name} />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
