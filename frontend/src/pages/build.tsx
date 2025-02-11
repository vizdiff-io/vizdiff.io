import CancelIcon from "@mui/icons-material/Cancel"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import {
  Box,
  Button,
  Typography,
  Paper,
  CircularProgress,
  ImageList,
  ImageListItem,
} from "@mui/material"
import Head from "next/head"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"

import { NavBody } from "@/components/NavBody"
import TestResultCard from "@/components/TestResultCard"
import TestResultDialog from "@/components/TestResultDialog"
import useApiGet from "@/hooks/useApiGet"
import useAppTheme from "@/hooks/useAppTheme"
import type { ScreenshotTestResponse, TestResponse, TestResultResponse } from "@/lib/apiTypes"
import { getStatusColor } from "@/lib/colors"

function getStatusText(status: ScreenshotTestResponse["status"]): string {
  switch (status) {
    case "pending":
      return "Pending"
    case "running":
      return "Running"
    case "no_changes":
      return "No changes"
    case "unapproved":
      return "Unapproved"
    case "approved":
      return "Approved"
    case "denied":
      return "Denied"
    case "failed":
      return "Failed"
    default:
      return "Unknown"
  }
}

export default function Build(): JSX.Element {
  const router = useRouter()
  const { id } = router.query

  // Validate ID before making the API request
  const isValidId = typeof id === "string" && /^\d+$/.test(id)
  const [data, loading, error] = useApiGet<TestResponse>(isValidId ? `/api/tests/${id}` : undefined)
  const [selectedResult, setSelectedResult] = useState<TestResultResponse | null>(null)
  const theme = useAppTheme()

  // Handle invalid ID with useEffect for client-side navigation
  useEffect(() => {
    if (!isValidId && router.isReady) {
      void router.push("/projects")
    }
  }, [isValidId, router, router.isReady])

  // Show loading state while redirecting or if the page is not yet ready
  if (!router.isReady || !isValidId) {
    return (
      <NavBody>
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      </NavBody>
    )
  }

  const handleApprove = async () => {
    // TASK: Implement approve API call
    console.log("Approve build", id)
  }

  const handleDeny = async () => {
    // TASK: Implement deny API call
    console.log("Deny build", id)
  }

  const tests = data?.testResults.length
  const changes = data?.testResults.filter((result) => result.changeStatus !== "unchanged").length
  const status = data?.status
  const approveEnabled = status === "unapproved" || status === "denied"
  const denyEnabled = status === "unapproved" || status === "approved"

  return (
    <>
      <Head>
        <title>{data?.buildNumber ? `Build ${data.buildNumber}` : "Build"} - vizdiff.io</title>
        <meta name="description" content="Build details and test results" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <NavBody>
        <Box sx={{ px: 3, py: 4 }}>
          {error && (
            <Paper sx={{ p: 2, mb: 3, bgcolor: "error.light", color: "error.contrastText" }}>
              {error.message}
            </Paper>
          )}

          {/* Build header */}
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : !data ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
                Build not found
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}
            >
              <Box>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
                  {`Build #${data.buildNumber}`}
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  {data.commitSha} on {data.branch}
                </Typography>
                {data.parent && (
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Comparing with Build {data.parent.buildNumber} ({data.parent.commitSha})
                  </Typography>
                )}
                <Box sx={{ display: "flex", gap: 3 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 500 }}>
                      {tests ?? "…"}
                    </Typography>
                    <Typography variant="body2">Tests</Typography>
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 500 }}>
                      {changes ?? "…"}
                    </Typography>
                    <Typography variant="body2">Changes</Typography>
                  </Box>
                  <Box>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 500,
                        color: getStatusColor(theme, data.status),
                      }}
                    >
                      {getStatusText(data.status)}
                    </Typography>
                    <Typography variant="body2">Status</Typography>
                  </Box>
                </Box>
              </Box>
              <Box sx={{ display: "flex", gap: 2 }}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={handleApprove}
                  disabled={!approveEnabled}
                >
                  Approve
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={handleDeny}
                  disabled={!denyEnabled}
                >
                  Deny
                </Button>
              </Box>
            </Box>
          )}

          {/* Test Results */}
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              {/* Test Results Grid */}
              <ImageList sx={{ width: "100%", height: "100%" }} cols={3} gap={16}>
                {(data?.testResults ?? []).map((result) => (
                  <ImageListItem key={result.id}>
                    <TestResultCard result={result} onOpenFullscreen={setSelectedResult} />
                  </ImageListItem>
                ))}
              </ImageList>
            </Box>
          )}

          {/* Fullscreen Dialog */}
          <TestResultDialog result={selectedResult} onClose={() => setSelectedResult(null)} />
        </Box>
      </NavBody>
    </>
  )
}
