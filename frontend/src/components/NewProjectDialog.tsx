import CloseIcon from "@mui/icons-material/Close"
import {
  List,
  ListItemButton,
  ListItemText,
  Divider,
  CircularProgress,
  IconButton,
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

const API_ME_URL = "/api/users/me"
const API_ORGS_URL = "/api/github/orgs"
const API_REPOS_URL = "/api/github/repos"

interface User {
  githubUsername: string
}

export default function NewProjectDialog({ onClose }: NewProjectDialogProps): JSX.Element {
  const [repos, setRepos] = useState<GithubRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [_error, setError] = useState<string | null>(null)

  const [me, isMeLoading, _meErr] = useAuthenticatedFetch<User>(API_ME_URL)
  const [orgs, isOrgsLoading, _orgsErr] = useAuthenticatedFetch<GithubOrg[]>(API_ORGS_URL)

  const updateLoading = useCallback(() => {
    if (!isMeLoading && !isOrgsLoading) {
      setLoading(false)
    }
  }, [isMeLoading, isOrgsLoading])

  useEffect(() => updateLoading(), [updateLoading])

  const handleMeClick = async () => {
    setLoading(true)
    const [meRepos, _meReposError] = await apiGet(API_REPOS_URL)
    setRepos((meRepos as [] | null) ?? [])
    updateLoading()
  }

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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      {/* Close button at the top right */}
      <div style={{ alignSelf: "flex-end", marginBottom: "10px" }}>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </div>

      {/* Orgs and Repos lists */}
      <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start" }}>
        <List component="nav">
          {me && (
            <ListItemButton key={me.githubUsername} onClick={() => handleMeClick()}>
              <ListItemText primary={me.githubUsername} />
            </ListItemButton>
          )}
          {orgs?.map((org) => (
            <ListItemButton key={org.id} onClick={() => handleOrgClick(org.login)}>
              <ListItemText primary={org.login} />
            </ListItemButton>
          ))}
        </List>
        <Divider orientation="vertical" flexItem />
        {repos.length > 0 && (
          <List component="nav">
            {repos.map((repo) => (
              <ListItemButton key={repo.id} onClick={() => handleRepoClick(repo)}>
                <ListItemText primary={repo.name} />
              </ListItemButton>
            ))}
          </List>
        )}
        {loading && <CircularProgress />}
      </div>
    </div>
  )
}
