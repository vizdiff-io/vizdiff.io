import foxglove from "@foxglove/eslint-plugin"
import * as tseslint from "typescript-eslint"

import { baseConfig, nodeConfig, rulesConfig } from "../eslint.config.mjs"

export default tseslint.config(
  ...baseConfig,
  ...foxglove.configs.base,
  ...foxglove.configs.typescript,
  tseslint.configs.recommendedTypeChecked,
  nodeConfig,
  { files: ["src/**/*.ts"] },
  rulesConfig,
)
