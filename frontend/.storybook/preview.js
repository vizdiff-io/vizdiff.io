import { ThemeProvider } from "@material-ui/core/styles"
import { withScreenshot } from "storycap"
import theme from "../src/theme"

const withThemeProvider = (Story, context) => {
  return (
    <ThemeProvider theme={theme}>
      <Story {...context} />
    </ThemeProvider>
  )
}

export const decorators = [withThemeProvider, withScreenshot]

const preview = {
  parameters: {
    html: {
      prettier: {
        tabWidth: 2,
        useTabs: false,
        htmlWhitespaceSensitivity: "strict",
      },
    },
    screenshot: {
      viewports: {
        desktop: {
          width: 1920,
          height: 1080,
        },
        mobile: {
          width: 375,
          height: 667,
        },
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
