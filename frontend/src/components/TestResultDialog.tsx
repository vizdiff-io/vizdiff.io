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
import { useState } from "react"

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

  if (!result) {
    return null
  }

  // Reset to "new" view if trying to view a mode that requires ancestorScreenshotUrl
  if (!result.ancestorScreenshotUrl && (viewMode === "old" || viewMode === "split")) {
    setViewMode("new")
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
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h6" component="div">
            {result.name}
          </Typography>
          <Typography variant="body2" color={changeStatusColor(result.changeStatus)}>
            {changeStatusMessage(result.changeStatus)}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
          >
            <ToggleButton value="old" disabled={!result.ancestorScreenshotUrl}>
              <LayersIcon sx={{ mr: 1 }} />
              Old
            </ToggleButton>
            <ToggleButton value="new">
              <LayersIcon sx={{ mr: 1 }} />
              New
            </ToggleButton>
            <ToggleButton value="diff" disabled={!result.diffMaskUrl}>
              <CompareIcon sx={{ mr: 1 }} />
              Diff
            </ToggleButton>
            <ToggleButton value="split" disabled={!result.ancestorScreenshotUrl}>
              <GridViewIcon sx={{ mr: 1 }} />
              2-up
            </ToggleButton>
          </ToggleButtonGroup>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {viewMode === "split" ? (
          <Box sx={{ display: "flex", width: "100%", height: "100%", gap: 2, p: 2 }}>
            <Box sx={{ flex: 1, position: "relative" }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Old Version
              </Typography>
              <Box sx={{ position: "relative", width: "100%", height: "calc(100% - 28px)" }}>
                <Image
                  src={result.ancestorScreenshotUrl ?? result.screenshotUrl}
                  alt={`Old version of ${result.name}`}
                  layout="fill"
                  objectFit="contain"
                />
              </Box>
            </Box>
            <Box sx={{ flex: 1, position: "relative" }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                New Version
              </Typography>
              <Box sx={{ position: "relative", width: "100%", height: "calc(100% - 28px)" }}>
                <Image
                  src={result.screenshotUrl}
                  alt={`New version of ${result.name}`}
                  layout="fill"
                  objectFit="contain"
                />
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ position: "relative", width: "100%", height: "100%", p: 2 }}>
            <Image
              src={getImageUrl()}
              alt={`Screenshot for ${result.name}`}
              layout="fill"
              objectFit="contain"
            />
            {viewMode === "diff" && result.diffMaskUrl && (
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                }}
              >
                <Image
                  src={result.diffMaskUrl}
                  alt={`Diff mask for ${result.name}`}
                  layout="fill"
                  objectFit="contain"
                  style={{ opacity: 0.5 }}
                />
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}
