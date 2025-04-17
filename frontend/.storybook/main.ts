import type { StorybookConfig } from "@storybook/nextjs"
import { join, dirname } from "path"
import webpack from "webpack"

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, "package.json")))
}

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  staticDirs: ["../public", "../src/stories/assets"],
  addons: [
    getAbsolutePath("@storybook/addon-links"),
    getAbsolutePath("@storybook/addon-essentials"),
    getAbsolutePath("@storybook/addon-interactions"),
  ],
  framework: {
    name: getAbsolutePath("@storybook/nextjs"),
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
  webpackFinal: async (config) => {
    // Add environment variables to webpack's DefinePlugin
    const definePlugin = new webpack.DefinePlugin({
      "process.env.NEXT_PUBLIC_GITHUB_APP_NAME": JSON.stringify(
        process.env.NEXT_PUBLIC_GITHUB_APP_NAME,
      ),
      "process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID": JSON.stringify(
        process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID,
      ),
      "process.env.NEXT_PUBLIC_APP_URL": JSON.stringify(process.env.NEXT_PUBLIC_APP_URL),
      "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(process.env.NEXT_PUBLIC_API_URL),
    })
    config.plugins = config.plugins || []
    config.plugins.push(definePlugin)
    return config
  },
}

export default config
