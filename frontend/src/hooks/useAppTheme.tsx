import type { Theme } from "@mui/material"
import { useMemo } from "react"

import { createAppTheme } from "@/lib/theme"

import { useDarkMode } from "./useDarkMode"

// This should only be used with helpers like getStatusColor() where the color
// does not change based on the light/dark mode.
export default function useAppTheme(): Theme {
  const isDarkMode = useDarkMode()
  return useMemo(() => createAppTheme(isDarkMode ? "dark" : "light"), [isDarkMode])
}
