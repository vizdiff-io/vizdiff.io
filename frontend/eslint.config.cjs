const { FlatCompat } = require("@eslint/eslintrc")
const foxglove = require("@foxglove/eslint-plugin")
const tseslint = require("typescript-eslint")

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

module.exports = tseslint.config(
  ...foxglove.configs.base,
  ...foxglove.configs.react,
  ...foxglove.configs.typescript,
  ...compat.config({
    extends: ["next/core-web-vitals"],
    settings: {
      next: {
        rootDir: __dirname,
      },
    },
  }),
  ...compat.config({
    extends: ["plugin:storybook/recommended"],
  }),
  {
    ignores: [
      ".storybook/**",
      "cloudfront/**",
      "public/**",
      "next.config.mjs",
      "eslint.config.cjs",
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    files: ["src/pages/**/*", "src/stories/**/*"],
    rules: {
      "filenames/match-exported": "off",
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
