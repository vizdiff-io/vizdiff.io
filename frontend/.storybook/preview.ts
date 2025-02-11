import "../src/styles/globals.css"
import "../src/styles/theme.css"
import { initialize, mswLoader } from "msw-storybook-addon"
import type { Preview } from "@storybook/react"

// Initialize MSW
initialize()

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
  loaders: [mswLoader],
}

export default preview
