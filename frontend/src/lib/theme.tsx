import { createTheme, type Theme } from "@mui/material"

export const COLORS: Record<string, { light: string; dark: string }> = {
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
  "text-on-primary": {
    light: "#000000",
    dark: "#000000",
  },
  "gradient-text": {
    light: "linear-gradient(to right, #000 60%, rgba(0,0,0,0.5))",
    dark: "linear-gradient(to right, #fff 60%, rgba(255,255,255,0.5))",
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

export function createAppTheme(mode: "dark" | "light"): Theme {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: "#5cc5ff", // Maya blue
      },
      secondary: {
        main: "#23a0fa", // Celestial blue
      },
      success: {
        main: "#679436", // Asparagus
      },
      info: {
        main: "#5cc5ff", // Maya blue
      },
      warning: {
        main: "#f19953", // Sandy brown
      },
      error: {
        main: "#a5243d", // Amaranth purple
      },
    },
    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      h1: {
        fontSize: "3.5rem",
        fontWeight: 600,
        lineHeight: 1.2,
        color: "var(--text-primary)",
      },
      h2: {
        fontSize: "2.25rem",
        fontWeight: 600,
        color: "var(--text-primary)",
      },
      body1: {
        fontSize: "1rem",
        lineHeight: 1.5,
        color: "var(--text-primary)",
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
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: "var(--bg-paper)",
            color: "var(--text-primary)",
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
            color: "var(--text-on-primary)",
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
            backgroundColor: "transparent",
            backgroundImage: "none",
            boxShadow: "none",
            borderBottom: "1px solid var(--twelve-percent-opacity)",
          },
        },
      },
      MuiTypography: {
        styleOverrides: {
          root: {
            color: "var(--text-primary)",
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiInputBase-root": {
              color: "var(--text-primary)",
            },
            "& .MuiFormLabel-root": {
              color: "var(--seventy-percent-opacity)",
            },
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            color: "var(--seventy-percent-opacity)",
          },
        },
      },
    },
  })
}
