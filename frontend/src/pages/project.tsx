import CircleIcon from "@mui/icons-material/Circle"
import ContentCopyIcon from "@mui/icons-material/ContentCopy"
import { Box, Typography, Paper, useTheme, IconButton, Tooltip } from "@mui/material"
import { formatDistanceToNow } from "date-fns"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState } from "react"

import { AppLayout } from "@/components/AppLayout"
import useApiGet from "@/hooks/useApiGet"
import type { ProjectResponse, ScreenshotTestSummaryResponse } from "@/lib/apiTypes"
import { getStatusColor } from "@/lib/colors"
import { plural } from "@/lib/text"

export default function Project(): JSX.Element {
  const router = useRouter()
  const theme = useTheme()
  const { id } = router.query
  const isValidId = typeof id === "string" && /^\d+$/.test(id)
  const [project, projectLoading, projectError] = useApiGet<ProjectResponse>(
    isValidId ? `/api/projects/${id}` : undefined,
  )
  const [buildsResponse, buildsLoading, buildsError] = useApiGet<ScreenshotTestSummaryResponse[]>(
    isValidId ? `/api/projects/${id}/builds` : undefined,
  )
  const builds = buildsResponse ?? []
  const [copyTooltip, setCopyTooltip] = useState("Copy")

  const loading = projectLoading || buildsLoading
  const error = projectError ?? buildsError

  const handleCopyToken = async () => {
    if (project?.token) {
      try {
        console.log(`Copying token "${project.token}"`)
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

  return (
    <>
      <Head>
        <title>{project?.name ? `${project.name} - vizdiff.io` : "vizdiff.io"}</title>
        <meta name="description" content="Project builds and details" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <AppLayout>
        <Box sx={{ px: 3, py: 4 }}>
          {error && (
            <Paper sx={{ p: 2, mb: 3, bgcolor: "error.light", color: "error.contrastText" }}>
              {error.message}
            </Paper>
          )}

          {project?.token && (
            <Paper
              sx={{
                p: 2,
                mb: 3,
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  <strong>VIZDIFF_PROJECT_TOKEN</strong>
                </Typography>
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
                  {project.token}
                </Typography>
              </Box>
              <Tooltip title={copyTooltip}>
                <IconButton onClick={handleCopyToken} size="small">
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
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
                      p: 3,
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
                    <Box sx={{ flex: 1 }}>
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
                        {build.commitSha} on {build.branch}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", gap: 4, ml: 2 }}>
                      <Box sx={{ textAlign: "center" }}>
                        <Typography variant="h6">{build.components ?? "…"}</Typography>
                        <Typography variant="caption">
                          Component{plural(build.components ?? 0)}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "center" }}>
                        <Typography variant="h6">{build.stories ?? "…"}</Typography>
                        <Typography variant="caption">
                          {build.stories === 1 ? "Story" : "Stories"}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "center" }}>
                        <Typography variant="h6">{build.changes ?? "…"}</Typography>
                        <Typography variant="caption">
                          Change{plural(build.changes ?? 0)}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Link>
              ))}
            </Box>
          )}
        </Box>
      </AppLayout>
    </>
  )
}
