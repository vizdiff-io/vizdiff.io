import { Box, Paper, Typography } from "@mui/material"

interface ProjectCardProps {
  repo: {
    id: number
    name: string
    full_name: string
    html_url: string
  }
}

export default function ProjectCard({ repo }: ProjectCardProps): JSX.Element {
  return (
    <Paper
      component="a"
      href={`/project?id=${repo.id}`}
      sx={{
        p: 3,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        textDecoration: "none",
        "&:hover": { bgcolor: "action.hover", cursor: "pointer" },
      }}
    >
      <Typography variant="h6" component="h2">
        {repo.name}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2">{repo.full_name}</Typography>
      </Box>
    </Paper>
  )
}
