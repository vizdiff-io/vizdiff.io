import type { TestResult } from "@/lib/apiTypes"
import { Box, Paper, Typography, IconButton } from "@mui/material"
import Image from "next/image"
import OpenInFullIcon from "@mui/icons-material/OpenInFull"

interface TestResultCardProps {
  result: TestResult
  onOpenFullscreen: (result: TestResult) => void
}

export default function TestResultCard({ result, onOpenFullscreen }: TestResultCardProps) {
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
        <IconButton
          size="small"
          onClick={() => onOpenFullscreen(result)}
          sx={{ color: "text.secondary" }}
        >
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
            bgcolor: result.hasDiff ? "error.main" : "success.main",
          }}
        />
        <Typography variant="body2" color="text.secondary">
          {result.hasDiff ? "Changes detected" : "No changes"}
        </Typography>
      </Box>
    </Paper>
  )
}
