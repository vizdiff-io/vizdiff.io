import CircleIcon from "@mui/icons-material/Circle"
import ContentCopyIcon from "@mui/icons-material/ContentCopy"
import RefreshIcon from "@mui/icons-material/Refresh"
import {
  Box,
  Typography,
  Paper,
  useTheme,
  IconButton,
  Tooltip,
  Link as MuiLink,
  CircularProgress,
  Button,
} from "@mui/material"
import { AxiosError } from "axios"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/router"
import { type JSX, useCallback, useEffect, useState } from "react"

import { AppLayout } from "@/components/AppLayout"
import { Seo } from "@/components/Seo"
import useApiGet from "@/hooks/useApiGet"
import useAuth from "@/hooks/useAuth"
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs"
import { apiGet, apiPost } from "@/lib/apiMethods"
import type {
  BuildsListResponse,
  ProjectResponse,
  ScreenshotTestSummaryResponse,
} from "@/lib/apiTypes"
import { getStatusColor } from "@/lib/colors"
import { getBranchUrl, getCommitUrl, getPullRequestUrl } from "@/lib/links"
import { plural } from "@/lib/text"

export default function Project(): JSX.Element {
  const router = useRouter()
  const { setBreadcrumbData } = useBreadcrumbs()
  const { user } = useAuth()
  const theme = useTheme()
  const { id } = router.query
  const projectId = getProjectId(id)
  const [project, projectLoading, projectError] = useApiGet<ProjectResponse>(
    projectId ? `/api/projects/${projectId}` : undefined,
  )
  const projectName = project?.name
  const {
    builds,
    loading: buildsLoading,
    loadingMore: buildsLoadingMore,
    hasMore: buildsHasMore,
    error: buildsError,
    loadMore: loadMoreBuilds,
  } = useBuilds(projectId)
  const [copyTooltip, setCopyTooltip] = useState("Copy")
  const [resetTokenLoading, setResetTokenLoading] = useState(false)
  const [resetTokenTooltip, setResetTokenTooltip] = useState("Reset Token")
  const [currentToken, setCurrentToken] = useState<string | undefined>(project?.token)

  const loading = projectLoading || buildsLoading
  const error = projectError ?? buildsError

  // Handle invalid ID with useEffect for client-side navigation
  useEffect(() => {
    if (!projectId && router.isReady) {
      void router.push("/projects")
    }
  }, [projectId, router, router.isReady])

  useEffect(() => {
    setBreadcrumbData({
      projectId,
      projectName,
      buildId: undefined,
      buildNumber: undefined,
    })

    return () => {
      setBreadcrumbData({
        projectId: undefined,
        projectName: undefined,
        buildId: undefined,
        buildNumber: undefined,
      })
    }
  }, [projectId, projectName, setBreadcrumbData])

  // Update token state when project data changes
  useEffect(() => {
    if (project?.token) {
      setCurrentToken(project.token)
    }
  }, [project?.token])

  const isProjectOwner = project != undefined && project.ownerId === user?.id

  const handleCopyToken = async () => {
    if (project?.token) {
      try {
        await navigator.clipboard.writeText(project.token)
        setCopyTooltip("Copied!")
        setTimeout(() => setCopyTooltip("Copy"), 2000)
      } catch (err) {
        console.error("Failed to copy token:", err)
        setCopyTooltip("Copy failed")
        setTimeout(() => setCopyTooltip("Copy"), 2000)
      }
    }
  }

  const handleResetToken = async () => {
    if (!projectId) {
      return
    }

    setResetTokenLoading(true)
    setResetTokenTooltip("Resetting...")

    try {
      const [updatedProject, apiError] = await apiPost<ProjectResponse>(
        `/api/projects/${projectId}/reset-token`,
        {},
      )

      if (apiError) {
        console.error("Failed to reset token:", apiError)
        setResetTokenTooltip("Failed!")
      } else if (updatedProject?.token) {
        // Update the token in the UI
        setCurrentToken(updatedProject.token)
        setResetTokenTooltip("Success!")
      }
    } catch (err) {
      console.error("Failed to reset token:", err)
      setResetTokenTooltip("Failed!")
    } finally {
      setResetTokenLoading(false)
      setTimeout(() => setResetTokenTooltip("Reset Token"), 2000)
    }
  }

  // Show loading state while redirecting or if the page is not yet ready
  if (!router.isReady || !projectId) {
    return (
      <>
        <Seo title="VizDiff: Project" path="/project"></Seo>
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
      <Seo
        title={project?.name ? `${project.name} - VizDiff` : "VizDiff"}
        path={`/project?id=${projectId}`}
      ></Seo>
      <AppLayout>
        <Box sx={{ px: { xs: 0, sm: 3 }, py: { xs: 0, sm: 4 } }}>
          {error && (
            <Paper sx={{ p: 2, mb: 3, bgcolor: "error.light", color: "error.contrastText" }}>
              {error.message}
            </Paper>
          )}

          {project && currentToken && (
            <Paper
              sx={{
                p: 2,
                mb: 3,
                display: "inline-flex",
                alignItems: { xs: "flex-start", sm: "center" },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: { xs: "flex-start", sm: "center" },
                  gap: { xs: 0.5, sm: 2 },
                  flexDirection: { xs: "column", sm: "row" },
                }}
              >
                <Typography variant="caption">
                  <strong>VIZDIFF_PROJECT_TOKEN</strong>
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography
                    variant="body2"
                    component="code"
                    sx={{
                      fontFamily: "monospace",
                      bgcolor: "action.hover",
                      p: 1,
                      borderRadius: 1,
                    }}
                  >
                    {currentToken}
                  </Typography>
                  <Box sx={{ display: "flex" }}>
                    <Tooltip title={copyTooltip}>
                      <IconButton onClick={handleCopyToken} size="small">
                        <ContentCopyIcon />
                      </IconButton>
                    </Tooltip>
                    {isProjectOwner && (
                      <Tooltip title={resetTokenTooltip}>
                        <IconButton
                          onClick={handleResetToken}
                          size="small"
                          disabled={resetTokenLoading}
                        >
                          {resetTokenLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              </Box>
            </Paper>
          )}

          <Box
            sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}
          >
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
              Builds
            </Typography>
            {/* <Box sx={{ display: "flex", gap: 1 }}>
              <Button variant="outlined" endIcon={<KeyboardArrowDownIcon />}>
                All branches
              </Button>
            </Box> */}
          </Box>

          {loading ? (
            <Typography>Loading project...</Typography>
          ) : builds.length === 0 ? (
            <Typography>No builds for {project?.name ?? "this project"} yet</Typography>
          ) : (
            <Box>
              {builds.map((build) => (
                <Link
                  key={build.id}
                  href={`/build?id=${build.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <Paper
                    sx={{
                      p: { xs: 2, sm: 3 },
                      mb: 2,
                      display: "flex",
                      alignItems: "center",
                      "&:hover": { bgcolor: "action.hover" },
                      cursor: "pointer",
                    }}
                  >
                    <CircleIcon
                      sx={{
                        mr: 2,
                        fontSize: 16,
                        color: getStatusColor(theme, build.status),
                      }}
                    />
                    <Box sx={{ flex: 1, overflow: "hidden" }}>
                      <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                        <Typography variant="h6" component="h2" sx={{ mr: 2 }}>
                          Build #{build.buildNumber}
                        </Typography>
                        {build.tag && (
                          <Paper
                            sx={{
                              px: 1.5,
                              py: 0.5,
                              bgcolor: "success.light",
                              borderRadius: 2,
                              display: { xs: "none", sm: "block" },
                            }}
                          >
                            <Typography variant="caption" sx={{ color: "black" }}>
                              {build.tag}
                            </Typography>
                          </Paper>
                        )}
                      </Box>
                      <Typography variant="body2">
                        Created {formatDistanceToNow(build.initiatedStampSec * 1000)} ago •{" "}
                        <Tooltip title={build.commitSha}>
                          <MuiLink
                            href={getCommitUrl(
                              build.commitSha,
                              project?.repoUrl,
                              build.prNumber,
                              // Use project.vcsProvider when using project.repoUrl for consistency
                              // build.vcsProvider should always match, but project is the source of truth
                              project?.vcsProvider ?? build.vcsProvider,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()} // Prevent triggering the parent Link
                            sx={{ fontFamily: "monospace" }}
                          >
                            {build.commitSha.substring(0, 7)}
                          </MuiLink>
                        </Tooltip>{" "}
                        on{" "}
                        <MuiLink
                          href={getBranchUrl(
                            build.branch,
                            project?.repoUrl,
                            // Use project.vcsProvider when using project.repoUrl for consistency
                            project?.vcsProvider ?? build.vcsProvider,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()} // Prevent triggering the parent Link
                          sx={{
                            fontFamily: "monospace",
                            maxWidth: "50%",
                            display: "inline-block",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            verticalAlign: "bottom",
                          }}
                        >
                          {build.branch}
                        </MuiLink>
                        {build.prNumber && (
                          <>
                            {" • "}
                            <MuiLink
                              href={getPullRequestUrl(
                                build.prNumber,
                                project?.repoUrl,
                                // Use project.vcsProvider when using project.repoUrl for consistency
                                project?.vcsProvider ?? build.vcsProvider,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()} // Prevent triggering the parent Link
                              sx={{
                                textDecoration: "none",
                                "&:hover": { textDecoration: "underline" },
                              }}
                            >
                              {`PR #${build.prNumber}`}
                            </MuiLink>
                          </>
                        )}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", gap: 4, ml: 2 }}>
                      <Box sx={{ textAlign: "center", display: { xs: "none", sm: "block" } }}>
                        <Typography variant="h6">{build.stories ?? 0}</Typography>
                        <Typography variant="caption">
                          {build.stories === 1 ? "Test" : "Tests"}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "center" }}>
                        <Typography variant="h6">{build.changes ?? 0}</Typography>
                        <Typography variant="caption">
                          Change{plural(build.changes ?? 0)}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Link>
              ))}
              {buildsHasMore && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 1 }}>
                  <Button
                    variant="outlined"
                    onClick={() => void loadMoreBuilds()}
                    disabled={buildsLoadingMore}
                    startIcon={buildsLoadingMore ? <CircularProgress size={16} /> : undefined}
                  >
                    {buildsLoadingMore ? "Loading..." : "Load more"}
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </AppLayout>
    </>
  )
}

function getProjectId(id: string | string[] | undefined): number | undefined {
  if (typeof id === "string") {
    const parsedId = parseInt(id, 10)
    return isNaN(parsedId) ? undefined : parsedId
  }
  return undefined
}

/** Number of builds fetched per page by the project builds list. */
const BUILDS_PAGE_SIZE = 100

type UseBuildsResult = {
  builds: ScreenshotTestSummaryResponse[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: AxiosError | null
  loadMore: () => Promise<void>
}

/**
 * Incrementally loads a project's builds, fetching {@link BUILDS_PAGE_SIZE} at a time. The first
 * page loads automatically; subsequent pages are appended via {@link UseBuildsResult.loadMore}.
 */
function useBuilds(projectId: number | undefined): UseBuildsResult {
  const [builds, setBuilds] = useState<ScreenshotTestSummaryResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<AxiosError | null>(null)

  const fetchPage = useCallback(
    async (offset: number): Promise<BuildsListResponse | null> => {
      if (projectId == undefined) {
        return null
      }
      const [data, err] = await apiGet<BuildsListResponse>(
        `/api/projects/${projectId}/builds?limit=${BUILDS_PAGE_SIZE}&offset=${offset}`,
      )
      if (err) {
        setError(err)
        return null
      }
      setError(null)
      return data
    },
    [projectId],
  )

  // Load (or reload) the first page whenever the project changes.
  useEffect(() => {
    let cancelled = false
    if (projectId == undefined) {
      setBuilds([])
      setHasMore(false)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setBuilds([])
    setHasMore(false)
    fetchPage(0)
      .then((data) => {
        if (cancelled || !data) {
          return
        }
        setBuilds(data.builds)
        setHasMore(data.hasMore)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof AxiosError ? err : new AxiosError(String(err)))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [projectId, fetchPage])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) {
      return
    }
    setLoadingMore(true)
    try {
      const data = await fetchPage(builds.length)
      if (data) {
        setBuilds((prev) => [...prev, ...data.builds])
        setHasMore(data.hasMore)
      }
    } finally {
      setLoadingMore(false)
    }
  }, [builds.length, fetchPage, hasMore, loadingMore])

  return { builds, loading, loadingMore, hasMore, error, loadMore }
}
