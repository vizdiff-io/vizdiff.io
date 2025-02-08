import foxglove from "@foxglove/eslint-plugin"
import * as tseslint from "typescript-eslint"

export default tseslint.config(
  ...foxglove.configs.base,
  ...foxglove.configs.typescript,
  tseslint.configs.recommendedTypeChecked,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mjs"],
        },
        tsconfigRootDir: String(import.meta.dirname),
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
      "@typescript-eslint/promise-function-async": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
    },
  },
)
