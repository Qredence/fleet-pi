import { tanstackConfig } from "@tanstack/eslint-config"

export default [
  ...tanstackConfig,
  {
    files: ["src/components/agent-elements/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },
]
