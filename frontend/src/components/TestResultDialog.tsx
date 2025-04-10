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
import { useState, useEffect } from "react"

import type { TestResultResponse } from "@/lib/apiTypes"
import { changeStatusColor, changeStatusMessage } from "@/lib/changeStatus"

type ViewMode = "new" | "old" | "diff" | "split"

interface TestResultDialogProps {
  result: TestResultResponse | null
  onClose: () => void
}

export default function TestResultDialog({
  result,
  onClose,
}: TestResultDialogProps): JSX.Element | null {
  const [viewMode, setViewMode] = useState<ViewMode>("new")

  // Determine which view modes are available based on test result
  const hasAncestorScreenshot = result?.ancestorScreenshotUrl ? true : false
  const isNewStatus = result?.changeStatus === "new"
  const canShowOld = hasAncestorScreenshot && !isNewStatus
  const canShowDiff = hasAncestorScreenshot && !isNewStatus && (result?.diffMaskUrl ? true : false)
  const canShowSplit = hasAncestorScreenshot && !isNewStatus

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

  // Early return if no result
  if (!result) {
    return null
  }

  const handleViewModeChange = (_: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
    if (newMode) {
      setViewMode(newMode)
    }
  }

  const getImageUrl = () => {
    switch (viewMode) {
      case "old":
        return result.ancestorScreenshotUrl ?? result.screenshotUrl
      case "diff":
      case "split":
      case "new":
      default:
        return result.screenshotUrl
    }
  }

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
        }}
      >
        <Box>
          <Typography variant="h6" component="div">
            {result.name}
          </Typography>
          <Typography variant="body2" color={changeStatusColor(result.changeStatus)}>
            {changeStatusMessage(result.changeStatus, result.diffRatio ?? 0)}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
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
                    filter: "brightness(0) invert(1) sepia(1) hue-rotate(-100deg) saturate(10000%)",
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
