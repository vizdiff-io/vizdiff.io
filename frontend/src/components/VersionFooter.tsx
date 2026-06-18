import { Box, Typography } from "@mui/material"
import type React from "react"
import { useEffect, useState } from "react"

import { tryApiGet } from "@/lib/apiMethods"

interface VersionInfo {
  api: string
  worker: string | null
  workerOnline: boolean
}

/**
 * Small muted footer showing the running api, worker, and frontend versions. Versions are fetched
 * client-side (GET /api/version) and the frontend build id is read from Next's `__NEXT_DATA__`, so
 * the initial render is an empty placeholder (avoids a static-export hydration mismatch) and fills
 * in after mount. Degrades silently if the version endpoint is unavailable.
 */
export const VersionFooter: React.FC = () => {
  const [info, setInfo] = useState<VersionInfo | null>(null)
  const [uiVersion, setUiVersion] = useState<string>("")

  useEffect(() => {
    // Bracket access avoids the no-underscore-dangle lint on Next's `__NEXT_DATA__` global.
    const nextData = (window as unknown as Record<string, { buildId?: string } | undefined>)[
      "__NEXT_DATA__"
    ]
    const buildId = nextData?.buildId
    if (buildId) {
      setUiVersion(buildId)
    }
    void (async () => {
      const [data] = await tryApiGet<VersionInfo>("/api/version")
      if (data) {
        setInfo(data)
      }
    })()
  }, [])

  const parts: string[] = []
  if (info) {
    parts.push(`api ${info.api}`)
    const workerLabel = info.worker
      ? `worker ${info.worker}${info.workerOnline ? "" : " (offline)"}`
      : "worker unknown"
    parts.push(workerLabel)
  }
  if (uiVersion) {
    parts.push(`ui ${uiVersion}`)
  }

  return (
    <Box component="footer" sx={{ py: 1.5, textAlign: "center" }}>
      <Typography variant="caption" sx={{ color: "var(--text-secondary)", opacity: 0.7 }}>
        {/* Non-breaking space keeps layout stable before versions load. */}
        {parts.length > 0 ? parts.join(" · ") : " "}
      </Typography>
    </Box>
  )
}
