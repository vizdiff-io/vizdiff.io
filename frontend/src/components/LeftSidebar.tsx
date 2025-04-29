import { Box } from "@mui/material"
import type { JSX } from "react"

import SidebarContent from "./SidebarContent"

export type SidebarItem = "projects" | "billing" | "settings"

interface LeftSidebarProps {
  selectedItem: SidebarItem
}

export default function LeftSidebar({ selectedItem }: LeftSidebarProps): JSX.Element {
  return (
    <Box
      component="nav"
      sx={{
        width: 240,
        flexShrink: 0,
        display: { xs: "none", md: "block" },
      }}
    >
      <SidebarContent selectedItem={selectedItem} />
    </Box>
  )
}
