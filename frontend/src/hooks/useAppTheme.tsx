import type { Theme } from "@mui/material"
import { useMemo } from "react"

import { createAppTheme } from "@/lib/theme"

import { useDarkMode } from "./useDarkMode"

export default function useAppTheme(): Theme {
  const isDarkMode = useDarkMode()
  return useMemo(() => createAppTheme(isDarkMode ? "dark" : "light"), [isDarkMode])
}
