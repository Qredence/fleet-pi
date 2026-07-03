//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"
import tseslint from "typescript-eslint"

export default [
  {
    ignores: ["**/.vercel/**"],
  },
  ...tanstackConfig,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      complexity: ["error", 85],
      "max-lines": ["error", 1200],
      "max-lines-per-function": ["error", 460],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/*"],
              message:
                "UI components belong in @workspace/hax-design. Add to packages/hax-design/src/components/fleet-pi/ or components/openui/ instead.",
            },
          ],
        },
      ],
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "typeLike", format: ["PascalCase"] },
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
        },
        { selector: "function", format: ["camelCase", "PascalCase"] },
      ],
    },
  },
]
