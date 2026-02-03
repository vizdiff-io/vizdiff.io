import CancelIcon from "@mui/icons-material/Cancel"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import {
  Box,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Tooltip,
  Link as MuiLink,
} from "@mui/material"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/router"
import { type JSX, useEffect, useMemo, useState } from "react"

import { AppLayout } from "@/components/AppLayout"
import { Seo } from "@/components/Seo"
import TestResultCard from "@/components/TestResultCard"
import TestResultDialog from "@/components/TestResultDialog"
import useApiGet from "@/hooks/useApiGet"
import useAppTheme from "@/hooks/useAppTheme"
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs"
import type { ScreenshotTestResponse, TestResponse, TestResultResponse } from "@/lib/apiTypes"
import { getStatusColor } from "@/lib/colors"
import { getBranchUrl, getCommitUrl, getPullRequestUrl } from "@/lib/links"

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

  const status = data?.status
  const isPending = status === "pending" || status === "running"
  const testResults = data?.testResults
  const sortedTestResults = useMemo(
    () => (isPending ? [] : getSortedTestResults(testResults ?? [])),
    [isPending, testResults],
  )
  const tests = isPending ? undefined : sortedTestResults.length
  const changes = isPending
    ? undefined
    : sortedTestResults.filter((result) => result.changeStatus !== "unchanged").length
  const approveEnabled = status === "unapproved" || status === "denied"
  const denyEnabled = status === "unapproved" || status === "approved"

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
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: { xs: "stretch", sm: "center" },
            flexDirection: { xs: "column", sm: "row" },
            gap: { xs: 3, sm: 0 },
            mb: 4,
          }}
        >
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
              {`Build #${data.buildNumber}`}
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              Created {formatDistanceToNow(data.initiatedStampSec * 1000)} ago •{" "}
              <Tooltip title={data.commitSha}>
                <MuiLink
                  href={getCommitUrl(data.commitSha, data.repoUrl, data.prNumber, data.vcsProvider)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()} // Prevent triggering the parent Link
                  sx={{ fontFamily: "monospace" }}
                >
                  {data.commitSha.substring(0, 7)}
                </MuiLink>
              </Tooltip>{" "}
              on{" "}
              <MuiLink
                href={getBranchUrl(data.branch, data.repoUrl, data.vcsProvider)}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ fontFamily: "monospace" }}
              >
                {data.branch}
              </MuiLink>
              {data.prNumber && (
                <>
                  {" • "}
                  <MuiLink
                    href={getPullRequestUrl(data.prNumber, data.repoUrl, data.vcsProvider)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()} // Prevent triggering the parent Link
                  >
                    {`PR #${data.prNumber}`}
                  </MuiLink>
                </>
              )}
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
        ) : sortedTestResults.length === 0 ? (
          <Typography variant="body1" sx={{ textAlign: "center", py: 4 }}>
            This build does not contain any tests.
          </Typography>
        ) : (
          <Box
            sx={{
              display: "grid",
              // Responsive columns
              gridTemplateColumns: {
                xs: "repeat(1, 1fr)",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
              },
              gap: 2,
              "& > *": {
                width: "100%",
                maxWidth: "100%",
              },
            }}
          >
            {sortedTestResults.map((result, index) => (
              <TestResultCard
                key={result.id}
                result={result}
                onOpenFullscreen={setSelectedResult}
                isPriority={index < 6}
              />
            ))}
          </Box>
        )}

        {/* Fullscreen Dialog */}
        <TestResultDialog
          result={selectedResult}
          allResults={sortedTestResults}
          onNavigate={setSelectedResult}
          onClose={() => setSelectedResult(null)}
        />
      </>
    )
  }

  return (
    <>
      <Seo
        title={data?.buildNumber ? `VizDiff: Build ${data.buildNumber}` : "VizDiff: Build"}
        canonical={id ? `https://vizdiff.io/build?id=${id}` : `https://vizdiff.io/build`}
      ></Seo>
      <AppLayout>
        <Box sx={{ px: { xs: 0, sm: 3 }, py: { xs: 0, sm: 4 } }}>
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

function getSortedTestResults(testResults: TestResultResponse[]): TestResultResponse[] {
  // Create a copy of test results sorted by change status
  // (failed, changed, new, unchanged), then by name
  const statusOrder: { [key: string]: number } = {
    failed: 0,
    changed: 1,
    new: 2,
    unchanged: 3,
  }
  const sortedTestResults = testResults.slice().sort((a, b) => {
    const statusA = statusOrder[a.changeStatus] ?? 99
    const statusB = statusOrder[b.changeStatus] ?? 99

    if (statusA !== statusB) {
      return statusA - statusB // Sort by status priority
    }
    // If statuses are the same, sort by name alphabetically
    return a.name.localeCompare(b.name)
  })

  return sortedTestResults
}
