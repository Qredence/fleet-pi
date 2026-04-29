//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"

export default [
  ...tanstackConfig,
  {
    rules: {
      complexity: ["error", 85],
      "max-lines": ["error", 1200],
      "max-lines-per-function": ["error", 460],
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
