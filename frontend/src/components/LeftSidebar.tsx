import FolderIcon from "@mui/icons-material/Folder"
import ReceiptIcon from "@mui/icons-material/Receipt"
import SettingsIcon from "@mui/icons-material/Settings"
import { Box, List, ListItemButton, ListItemIcon, ListItemText } from "@mui/material"

export default function LeftSidebar(): JSX.Element {
  return (
    <Box sx={{ width: 200, flexShrink: 0 }}>
      <List>
        <ListItemButton selected>
          <ListItemIcon>
            <FolderIcon />
          </ListItemIcon>
          <ListItemText primary="Projects" />
        </ListItemButton>
        <ListItemButton>
          <ListItemIcon>
            <ReceiptIcon />
          </ListItemIcon>
          <ListItemText primary="Billing" />
        </ListItemButton>
        <ListItemButton>
          <ListItemIcon>
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText primary="Settings" />
        </ListItemButton>
      </List>
    </Box>
  )
}
