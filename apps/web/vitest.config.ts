import { defineConfig } from "vitest/config"
import viteTsConfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [viteTsConfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    pool: "threads",
    globals: false,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts", "src/**/*.{test,spec}.tsx"],
    exclude: ["node_modules/", "src/routeTree.gen.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "src/lib/pi/{chat-fetch,chat-message-helpers,chat-stream-state,command-policy,plan-mode,plan-parser,plan-questionnaire,plan-state,provenance-query,question-pending,resource-install-refresh,run-provenance,runtime/**,server-chat-stream,server-runtime,server-sessions,server-shared,server-utils,use-chat-storage,workspace-resource-catalog}.ts",
        "src/routes/api/chat/{provenance,run,runs}.ts",
        "src/routes/api/workspace/{file,health,item,items,reindex,search,tree}.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 65,
        statements: 80,
      },
      exclude: [
        "node_modules/",
        "src/routeTree.gen.ts",
        "src/**/*.{test,spec}.{ts,tsx}",
        "**/*.d.ts",
        "**/*.config.*",
        "**/tests/**",
      ],
    },
  },
})
