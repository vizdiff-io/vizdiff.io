import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew"
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos"
import CloseIcon from "@mui/icons-material/Close"
import CompareIcon from "@mui/icons-material/Compare"
import GridViewIcon from "@mui/icons-material/GridView"
import LayersIcon from "@mui/icons-material/Layers"
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material"
import Image from "next/image"
import { useState, useEffect, useMemo, useCallback } from "react"

import type { TestResultResponse } from "@/lib/apiTypes"
import { changeStatusColor, changeStatusMessage } from "@/lib/changeStatus"

type ViewMode = "new" | "old" | "diff" | "split"

interface TestResultDialogProps {
  result: TestResultResponse | null
  allResults: TestResultResponse[]
  onNavigate: (newResult: TestResultResponse) => void
  onClose: () => void
}

export default function TestResultDialog({
  result,
  allResults,
  onNavigate,
  onClose,
}: TestResultDialogProps): JSX.Element | null {
  // 1. State
  const [viewMode, setViewMode] = useState<ViewMode>("diff")

  // 2. Derived values (Memoized)
  const currentIndex = useMemo(() => {
    if (!result) {
      return -1
    }
    return allResults.findIndex((r) => r.id === result.id)
  }, [result, allResults])

  const canNavigatePrev = currentIndex > 0
  const canNavigateNext = currentIndex !== -1 && currentIndex < allResults.length - 1

  const hasAncestorScreenshot = result?.ancestorScreenshotUrl ? true : false
  const isNewStatus = result?.changeStatus === "new"
  const canShowOld = hasAncestorScreenshot && !isNewStatus
  const canShowDiff = hasAncestorScreenshot && !isNewStatus && (result?.diffMaskUrl ? true : false)
  const canShowSplit = hasAncestorScreenshot && !isNewStatus

  // 3. Callbacks (Memoized)
  const handleNavigatePrev = useCallback(() => {
    if (canNavigatePrev) {
      const prevResult = allResults[currentIndex - 1]
      if (prevResult) {
        onNavigate(prevResult)
      }
    }
  }, [allResults, currentIndex, onNavigate, canNavigatePrev])

  const handleNavigateNext = useCallback(() => {
    if (canNavigateNext) {
      const nextResult = allResults[currentIndex + 1]
      if (nextResult) {
        onNavigate(nextResult)
      }
    }
  }, [allResults, currentIndex, onNavigate, canNavigateNext])

  const handleViewModeChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
      if (newMode) {
        setViewMode(newMode)
      }
    },
    [],
  )

  const getImageUrl = useCallback(() => {
    if (!result) {
      return ""
    } // Should not happen

    switch (viewMode) {
      case "old":
        return result.ancestorScreenshotUrl ?? result.screenshotUrl
      case "diff":
      case "split":
      case "new":
      default:
        return result.screenshotUrl
    }
  }, [viewMode, result]) // Added result as dependency

  // 4. Effects
  // Reset to "new" view if current view mode isn't available based on status
  useEffect(() => {
    if (!result) {
      return
    }

    if (
      (viewMode === "old" && !canShowOld) ||
      (viewMode === "diff" && !canShowDiff) ||
      (viewMode === "split" && !canShowSplit)
    ) {
      setViewMode("new")
    }
  }, [viewMode, canShowOld, canShowDiff, canShowSplit, result])

  // Keyboard navigation effect
  useEffect(() => {
    if (!result) {
      return // Don't add listener if dialog is closed
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        handleNavigatePrev()
      } else if (event.key === "ArrowRight") {
        handleNavigateNext()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [result, handleNavigatePrev, handleNavigateNext])

  // 5. Early return (after all hooks)
  if (!result) {
    return null
  }

  // 6. JSX
  return (
    <Dialog
      open={!!result}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: {
          height: "calc(100vh - 64px)",
          maxHeight: "calc(100vh - 64px)",
          m: 2,
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flex: "0 0 auto",
          p: 2,
          pb: 1,
          gap: 1,
        }}
      >
        <Box
          sx={{
            flex: "1 1 65%",
            maxWidth: "65%",
            overflow: "hidden",
          }}
        >
          <Typography
            variant="h6"
            component="div"
            sx={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              direction: "rtl",
              textAlign: "left",
            }}
          >
            {result.name}
          </Typography>
          <Typography variant="body2" color={changeStatusColor(result.changeStatus)}>
            {changeStatusMessage(result.changeStatus, result.diffRatio ?? 0)}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexShrink: 0 }}>
          <IconButton onClick={handleNavigatePrev} disabled={!canNavigatePrev} size="small">
            <ArrowBackIosNewIcon fontSize="small" />
          </IconButton>
          <Typography variant="body2" sx={{ minWidth: "4ch", textAlign: "center" }}>
            {`${currentIndex + 1}/${allResults.length}`}
          </Typography>
          <IconButton onClick={handleNavigateNext} disabled={!canNavigateNext} size="small">
            <ArrowForwardIosIcon fontSize="small" />
          </IconButton>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
            color="primary"
          >
            <ToggleButton value="old" disabled={!canShowOld}>
              <LayersIcon sx={{ mr: 1 }} />
              Old
            </ToggleButton>
            <ToggleButton value="new">
              <LayersIcon sx={{ mr: 1 }} />
              New
            </ToggleButton>
            <ToggleButton value="diff" disabled={!canShowDiff}>
              <CompareIcon sx={{ mr: 1 }} />
              Diff
            </ToggleButton>
            <ToggleButton value="split" disabled={!canShowSplit}>
              <GridViewIcon sx={{ mr: 1 }} />
              2-up
            </ToggleButton>
          </ToggleButtonGroup>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ flex: 1, p: 2, overflow: "hidden", display: "flex" }}>
        {viewMode === "split" ? (
          <Box sx={{ display: "flex", width: "100%", gap: 2, overflow: "hidden" }}>
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <Box sx={{ position: "relative", flex: 1, overflow: "hidden" }}>
                <Image
                  src={result.ancestorScreenshotUrl ?? result.screenshotUrl}
                  alt={`Old version of ${result.name}`}
                  fill
                  sizes="50vw"
                  style={{ objectFit: "contain" }}
                  priority
                />
              </Box>
            </Box>
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <Box sx={{ position: "relative", flex: 1, overflow: "hidden" }}>
                <Image
                  src={result.screenshotUrl}
                  alt={`New version of ${result.name}`}
                  fill
                  sizes="50vw"
                  style={{ objectFit: "contain" }}
                  priority
                />
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
            <Image
              src={getImageUrl()}
              alt={`Screenshot for ${result.name}`}
              fill
              sizes="100vw"
              style={{ objectFit: "contain" }}
              priority
            />
            {viewMode === "diff" && result.diffMaskUrl && (
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  overflow: "hidden",
                }}
              >
                <Image
                  src={result.diffMaskUrl}
                  alt={`Diff mask for ${result.name}`}
                  fill
                  sizes="100vw"
                  style={{
                    objectFit: "contain",
                    filter: "brightness(0) invert(1) sepia(1) hue-rotate(45deg) saturate(10000%)",
                  }}
                  priority
                />
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}
