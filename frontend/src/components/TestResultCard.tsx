import OpenInFullIcon from "@mui/icons-material/OpenInFull"
import { Box, Paper, Typography, IconButton } from "@mui/material"
import Image from "next/image"

import type { TestResultResponse } from "@/lib/apiTypes"
import { changeStatusColor, changeStatusMessage } from "@/lib/changeStatus"

interface TestResultCardProps {
  result: TestResultResponse
  onOpenFullscreen: (result: TestResultResponse) => void
}

export default function TestResultCard({
  result,
  onOpenFullscreen,
}: TestResultCardProps): JSX.Element {
  return (
    <Paper
      sx={{
        p: 2,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 1,
        position: "relative",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
          {result.name}
        </Typography>
        <IconButton size="small" onClick={() => onOpenFullscreen(result)}>
          <OpenInFullIcon />
        </IconButton>
      </Box>

      {/* Screenshot container */}
      <Box sx={{ position: "relative", width: "100%", pt: "56.25%" }}>
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        >
          {result.screenshotUrl && (
            <Image
              src={result.screenshotUrl}
              alt={`Screenshot for ${result.name}`}
              layout="fill"
              objectFit="contain"
            />
          )}
          {result.diffMaskUrl && (
            <Image
              src={result.diffMaskUrl}
              alt={`Diff mask for ${result.name}`}
              layout="fill"
              objectFit="contain"
              style={{ opacity: 0.5 }}
            />
          )}
        </Box>
      </Box>

      {/* Status indicator */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: changeStatusColor(result.changeStatus),
          }}
        />
        <Typography variant="body2">{changeStatusMessage(result.changeStatus)}</Typography>
      </Box>
    </Paper>
  )
}
