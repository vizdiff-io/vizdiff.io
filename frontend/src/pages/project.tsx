import CircleIcon from "@mui/icons-material/Circle"
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown"
import { Box, Button, Typography, Paper, useTheme } from "@mui/material"
import { formatDistanceToNow } from "date-fns"
import Head from "next/head"
import { useRouter } from "next/router"

import { NavBody } from "@/components/NavBody"
import useApiGet from "@/hooks/useApiGet"
import type { ProjectResponse, ScreenshotTestSummaryResponse } from "@/lib/apiTypes"
import { getStatusColor } from "@/lib/colors"

export default function Project(): JSX.Element {
  const router = useRouter()
  const { id } = router.query
  const theme = useTheme()
  const [project, projectLoading, projectError] = useApiGet<ProjectResponse>(`/api/projects/${id}`)
  const [builds, buildsLoading, buildsError] = useApiGet<ScreenshotTestSummaryResponse[]>(
    `/api/projects/${id}/builds`,
  )

  const loading = projectLoading || buildsLoading
  const error = projectError ?? buildsError

  return (
    <>
      <Head>
        <title>{project?.name ?? "Project"} - vizdiff.io</title>
        <meta name="description" content="Project builds and details" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <NavBody>
        <Box sx={{ px: 3, py: 4 }}>
          {error && (
            <Paper sx={{ p: 2, mb: 3, bgcolor: "error.light", color: "error.contrastText" }}>
              {error.message}
            </Paper>
          )}

          <Box
            sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}
          >
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
              Builds
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="outlined"
                endIcon={<KeyboardArrowDownIcon />}
                sx={{ color: "text.secondary" }}
              >
                All branches
              </Button>
            </Box>
          </Box>

          {loading ? (
            <Typography>Loading project...</Typography>
          ) : (
            <Box>
              {(builds ?? []).map((build) => (
                <Paper
                  key={build.id}
                  sx={{
                    p: 3,
                    mb: 2,
                    display: "flex",
                    alignItems: "center",
                    "&:hover": { bgcolor: "action.hover" },
                    cursor: "pointer",
                  }}
                  onClick={() => void router.push(`/build?id=${build.id}`)}
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
                            color: "success.dark",
                            borderRadius: 2,
                          }}
                        >
                          <Typography variant="caption">{build.tag}</Typography>
                        </Paper>
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Created {formatDistanceToNow(build.initiatedStampSec * 1000)} ago •{" "}
                      {build.commitSha} on {build.branch}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 4, ml: 2 }}>
                    <Box sx={{ textAlign: "center" }}>
                      <Typography variant="h6">{build.components ?? "…"}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Components
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "center" }}>
                      <Typography variant="h6">{build.stories ?? "…"}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Stories
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "center" }}>
                      <Typography variant="h6">{build.changes ?? "…"}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Changes
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
          )}
        </Box>
      </NavBody>
    </>
  )
}
