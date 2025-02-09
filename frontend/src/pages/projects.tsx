import { useState } from "react"
import { NavBody } from "@/components/NavBody"
import NewProjectDialog from "@/components/NewProjectDialog"
import useApiGet from "@/hooks/useApiGet"
import type { Project } from "@/lib/apiTypes"
import Head from "next/head"
import {
  Box,
  Button,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from "@mui/material"
import FolderIcon from "@mui/icons-material/Folder"
import ReceiptIcon from "@mui/icons-material/Receipt"
import SettingsIcon from "@mui/icons-material/Settings"
import AddIcon from "@mui/icons-material/Add"
import CircleIcon from "@mui/icons-material/Circle"

export default function Projects() {
  const [showModal, setShowModal] = useState(false)
  const [projects, loading, error] = useApiGet<Project[]>("/api/projects", [showModal])

  return (
    <>
      <Head>
        <title>Projects - vizdiff.io</title>
        <meta name="description" content="Project listing" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <NavBody>
        <Box sx={{ display: "flex", gap: 3, px: 3, py: 4, minHeight: "calc(100vh - 64px)" }}>
          {/* Left Sidebar */}
          <Box sx={{ width: 200, flexShrink: 0 }}>
            <List>
              <ListItem button selected>
                <ListItemIcon>
                  <FolderIcon />
                </ListItemIcon>
                <ListItemText primary="Projects" />
              </ListItem>
              <ListItem button>
                <ListItemIcon>
                  <ReceiptIcon />
                </ListItemIcon>
                <ListItemText primary="Billing" />
              </ListItem>
              <ListItem button>
                <ListItemIcon>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText primary="Settings" />
              </ListItem>
            </List>
          </Box>

          {/* Main Content */}
          <Box sx={{ flex: 1 }}>
            <Box
              sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}
            >
              <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
                Projects
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => setShowModal(true)}
              >
                Add project
              </Button>
            </Box>

            {error && (
              <Paper sx={{ p: 2, mb: 3, bgcolor: "error.light", color: "error.contrastText" }}>
                {error.message}
              </Paper>
            )}

            {loading ? (
              <Typography>Loading projects...</Typography>
            ) : (
              <Box>
                {projects?.map((project) => (
                  <Paper
                    key={project.id}
                    sx={{
                      p: 3,
                      mb: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <Box>
                      <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                        {project.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Last build 8mo ago • 4 Builds • 1 Component
                      </Typography>
                    </Box>
                    <Box>{/* Add any project actions here */}</Box>
                  </Paper>
                ))}
              </Box>
            )}
          </Box>

          {/* Right Activity Column */}
          <Box sx={{ width: 300, flexShrink: 0 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              ACTIVITY
            </Typography>
            <List>
              {[1, 2, 3].map((i) => (
                <ListItem key={i} sx={{ px: 0, py: 1 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <CircleIcon sx={{ fontSize: 12, color: "success.main" }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={`vizdiff.io #${i}`}
                    secondary="8mo ago"
                    primaryTypographyProps={{ variant: "body2" }}
                    secondaryTypographyProps={{ variant: "caption" }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </Box>

        {/* New Project Modal */}
        {showModal && <NewProjectDialog onClose={() => setShowModal(false)} />}
      </NavBody>
    </>
  )
}
