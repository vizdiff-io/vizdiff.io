import tseslint from "typescript-eslint"
import globals from "globals"

// Base configuration shared across all projects
export const baseConfig = tseslint.config({
  linterOptions: {
    reportUnusedDisableDirectives: "error",
  },
  languageOptions: {
    parserOptions: {
      project: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  ignores: [
    "**/.cache/",
    "**/.next/",
    "**/.vscode/",
    "**/.yarn/",
    "**/build/",
    "**/dist/",
    "**/node_modules/",
    "**/build.js",
    "**/eslint.config.*",
  ],
})

export const rulesConfig = {
  rules: {
    "@typescript-eslint/restrict-template-expressions": "off",
    "@typescript-eslint/strict-boolean-expressions": "off",
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
    "@typescript-eslint/promise-function-async": "off",
    "@typescript-eslint/no-confusing-void-expression": "off",
  },
}

export const nodeConfig = {
  languageOptions: {
    globals: {
      ...globals.node,
    },
    sourceType: "module",
  },
}

export default tseslint.config(...baseConfig)
