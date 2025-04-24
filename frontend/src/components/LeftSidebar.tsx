import FolderIcon from "@mui/icons-material/Folder"
import ReceiptIcon from "@mui/icons-material/Receipt"
import SettingsIcon from "@mui/icons-material/Settings"
import { Box, Link, List, ListItemButton, ListItemIcon, ListItemText } from "@mui/material"
import type { JSX } from "react"

export type SidebarItem = "projects" | "billing" | "settings"

interface LeftSidebarProps {
  selectedItem: SidebarItem
}

export default function LeftSidebar({ selectedItem }: LeftSidebarProps): JSX.Element {
  return (
    <Box sx={{ width: 200, flexShrink: 0 }}>
      <List>
        <Link href="/projects" sx={{ textDecoration: "none", color: "inherit" }}>
          <ListItemButton selected={selectedItem === "projects"}>
            <ListItemIcon>
              <FolderIcon />
            </ListItemIcon>
            <ListItemText primary="Projects" />
          </ListItemButton>
        </Link>
        <Link href="/signup" sx={{ textDecoration: "none", color: "inherit" }}>
          <ListItemButton selected={selectedItem === "billing"}>
            <ListItemIcon>
              <ReceiptIcon />
            </ListItemIcon>
            <ListItemText primary="Billing" />
          </ListItemButton>
        </Link>
        <Link href="/settings" sx={{ textDecoration: "none", color: "inherit" }}>
          <ListItemButton selected={selectedItem === "settings"}>
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary="Settings" />
          </ListItemButton>
        </Link>
      </List>
    </Box>
  )
}
