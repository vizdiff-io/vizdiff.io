import { createTheme } from "@mui/material/styles"

export const COLORS = {
  "bg-primary": {
    light: "#fefefe",
    dark: "#1a1d1e",
  },
  "bg-paper": {
    light: "#f8f9fa",
    dark: "#242728",
  },
  "text-primary": {
    light: "#1a1d1e",
    dark: "#ffffff",
  },
  "seventy-percent-opacity": {
    light: "rgba(0, 0, 0, 0.7)",
    dark: "rgba(255, 255, 255, 0.7)",
  },
  "twenty-percent-opacity": {
    light: "rgba(0, 0, 0, 0.2)",
    dark: "rgba(255, 255, 255, 0.2)",
  },
  "twelve-percent-opacity": {
    light: "rgba(0, 0, 0, 0.12)",
    dark: "rgba(255, 255, 255, 0.12)",
  },
  "five-percent-opacity": {
    light: "rgba(0, 0, 0, 0.05)",
    dark: "rgba(255, 255, 255, 0.05)",
  },
}

const theme = createTheme({
  palette: {
    primary: {
      main: "#5cc5ff",
    },
    background: {
      default: "var(--bg-primary)",
      paper: "var(--bg-paper)",
    },
    text: {
      primary: "var(--text-primary)",
      secondary: "var(--seventy-percent-opacity)",
    },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    h1: {
      fontSize: "3.5rem",
      fontWeight: 600,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: "2.25rem",
      fontWeight: 600,
    },
    body1: {
      fontSize: "1rem",
      lineHeight: 1.5,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "html, body": {
          backgroundColor: "var(--bg-primary)",
          color: "var(--text-primary)",
          minHeight: "100vh",
          transition: "background-color 0.2s ease",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: "8px",
          textTransform: "none",
          padding: "8px 16px",
          fontSize: "0.875rem",
          fontWeight: 500,
        },
        containedPrimary: {
          backgroundColor: "#5cc5ff",
          color: "var(--bg-paper)",
          "&:hover": {
            backgroundColor: "#45d3ff",
          },
        },
        outlinedPrimary: {
          borderColor: "var(--twelve-percent-opacity)",
          "&:hover": {
            borderColor: "var(--twenty-percent-opacity)",
            backgroundColor: "var(--five-percent-opacity)",
          },
        },
        textPrimary: {
          color: "var(--seventy-percent-opacity)",
          "&:hover": {
            backgroundColor: "var(--five-percent-opacity)",
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          color: "var(--text-primary)",
          backgroundColor: "var(--bg-paper)",
          boxShadow: "none",
          borderBottom: "1px solid var(--twelve-percent-opacity)",
        },
      },
    },
  },
})

export default theme
