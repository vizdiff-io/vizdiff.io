import FolderIcon from "@mui/icons-material/Folder"
import SettingsIcon from "@mui/icons-material/Settings"
import { Link, List, ListItemButton, ListItemIcon, ListItemText } from "@mui/material"
import type { JSX } from "react"

import type { SidebarItem } from "./LeftSidebar" // Assuming SidebarItem is exported from LeftSidebar

interface SidebarContentProps {
  selectedItem: SidebarItem | undefined // Allow undefined if route doesn't match known items
}

export default function SidebarContent({ selectedItem }: SidebarContentProps): JSX.Element {
  return (
    <List>
      <Link href="/projects" sx={{ textDecoration: "none", color: "inherit" }}>
        <ListItemButton selected={selectedItem === "projects"}>
          <ListItemIcon>
            <FolderIcon />
          </ListItemIcon>
          <ListItemText primary="Projects" />
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
  )
}
