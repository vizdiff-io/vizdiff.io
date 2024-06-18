import { createTheme } from "@mui/material/styles"

// Create a custom theme with your new color
const theme = createTheme({
  palette: {
    customColor: {
      main: "#ffffff",
      contrastText: "#666666",
    },
  },
})

export default theme
