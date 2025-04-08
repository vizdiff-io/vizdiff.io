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
  Tooltip,
  Link as MuiLink,
} from "@mui/material"
import { formatDistanceToNow } from "date-fns"
import Head from "next/head"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"

import { AppLayout } from "@/components/AppLayout"
import TestResultCard from "@/components/TestResultCard"
import TestResultDialog from "@/components/TestResultDialog"
import useApiGet from "@/hooks/useApiGet"
import useAppTheme from "@/hooks/useAppTheme"
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs"
import type { ScreenshotTestResponse, TestResponse, TestResultResponse } from "@/lib/apiTypes"
import { getStatusColor } from "@/lib/colors"
import { getBranchUrl, getCommitUrl } from "@/lib/links"

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
  const { setBreadcrumbData } = useBreadcrumbs()
  const { id } = router.query

  // Validate ID before making the API request
  const buildId = getBuildId(id)
  const [data, loading, error] = useApiGet<TestResponse>(
    buildId ? `/api/tests/${buildId}` : undefined,
  )
  const { projectId, projectName, buildNumber } = data ?? {}
  const [selectedResult, setSelectedResult] = useState<TestResultResponse | null>(null)
  const theme = useAppTheme()

  // Handle invalid ID with useEffect for client-side navigation
  useEffect(() => {
    if (!buildId && router.isReady) {
      void router.push("/projects")
    }
  }, [buildId, router, router.isReady])

  useEffect(() => {
    setBreadcrumbData({
      projectId,
      projectName,
      buildId,
      buildNumber,
    })

    return () => {
      setBreadcrumbData({
        projectId: undefined,
        projectName: undefined,
        buildId: undefined,
        buildNumber: undefined,
      })
    }
  }, [projectId, projectName, buildId, buildNumber, setBreadcrumbData])

  // Show loading state while redirecting or if the page is not yet ready
  if (!router.isReady || !buildId) {
    return (
      <AppLayout>
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      </AppLayout>
    )
  }

  const handleApprove = async () => {
    try {
      const response = await fetch(`/api/tests/${id}/status/approved`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to approve build")
      }

      // Refresh the data
      window.location.reload()
    } catch (err) {
      console.error("Error approving build:", err)
    }
  }

  const handleDeny = async () => {
    try {
      const response = await fetch(`/api/tests/${id}/status/denied`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to deny build")
      }

      // Refresh the data
      window.location.reload()
    } catch (err) {
      console.error("Error denying build:", err)
    }
  }

  const status = data?.status
  const isPending = status === "pending" || status === "running"
  const tests = isPending ? undefined : data?.testResults.length
  const changes = isPending
    ? undefined
    : data?.testResults.filter((result) => result.changeStatus !== "unchanged").length
  const approveEnabled = status === "unapproved" || status === "denied"
  const denyEnabled = status === "unapproved" || status === "approved"

  let content: JSX.Element

  if (loading) {
    content = (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    )
  } else if (!data) {
    content = (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
          Build not found
        </Typography>
      </Box>
    )
  } else {
    content = (
      <>
        {/* Build header */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
              {`Build #${data.buildNumber}`}
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              Created {formatDistanceToNow(data.initiatedStampSec * 1000)} ago •{" "}
              <Tooltip title={data.commitSha}>
                <MuiLink
                  href={getCommitUrl(data.commitSha, data.githubRepoUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()} // Prevent triggering the parent Link
                  sx={{
                    fontFamily: "monospace",
                    textDecoration: "none",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  {data.commitSha.substring(0, 7)}
                </MuiLink>
              </Tooltip>{" "}
              on{" "}
              <MuiLink
                href={getBranchUrl(data.branch, data.githubRepoUrl)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {data.branch}
              </MuiLink>
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

        {/* Test Results */}
        {isPending ? (
          <Typography variant="body1" sx={{ textAlign: "center", py: 4 }}>
            Tests are currently being rendered.
          </Typography>
        ) : data.testResults.length === 0 ? (
          <Typography variant="body1" sx={{ textAlign: "center", py: 4 }}>
            This build does not contain any tests.
          </Typography>
        ) : (
          <ImageList sx={{ width: "100%", height: "100%" }} cols={3} gap={16}>
            {data.testResults.map((result) => (
              <ImageListItem key={result.id}>
                <TestResultCard result={result} onOpenFullscreen={setSelectedResult} />
              </ImageListItem>
            ))}
          </ImageList>
        )}

        {/* Fullscreen Dialog */}
        <TestResultDialog result={selectedResult} onClose={() => setSelectedResult(null)} />
      </>
    )
  }

  return (
    <>
      <Head>
        <title>{data?.buildNumber ? `Build ${data.buildNumber}` : "Build"} - vizdiff.io</title>
        <meta name="description" content="Build details and test results" />
      </Head>
      <AppLayout>
        <Box sx={{ px: 3, py: 4 }}>
          {error && (
            <Paper sx={{ p: 2, mb: 3, bgcolor: "error.light", color: "error.contrastText" }}>
              {error.message}
            </Paper>
          )}
          {content}
        </Box>
      </AppLayout>
    </>
  )
}

function getBuildId(id: string | string[] | undefined): number | undefined {
  if (typeof id === "string") {
    const parsedId = parseInt(id, 10)
    return isNaN(parsedId) ? undefined : parsedId
  }
  return undefined
}
