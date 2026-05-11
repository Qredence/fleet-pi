import { defineConfig } from "vitest/config"
import viteTsConfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [viteTsConfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    pool: "threads",
    globals: false,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts", "src/**/*.{test,spec}.tsx"],
    exclude: [
      "node_modules/",
      "src/lib/pi/plan-mode.test.ts",
      "src/routeTree.gen.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50,
      },
      exclude: [
        "node_modules/",
        "src/routeTree.gen.ts",
        "**/*.d.ts",
        "**/*.config.*",
        "**/tests/**",
      ],
    },
  },
})
