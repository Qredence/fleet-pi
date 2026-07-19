import { defineConfig } from "@neon/config/v1"

export default defineConfig({
  auth: true,
  preview: {
    buckets: {
      sessions: {},
      artifacts: {},
    },
    functions: {
      chat: {
        name: "Fleet Pi Chat Runtime",
        source: "./functions/chat.ts",
        dev: { port: 8787 },
      },
    },
  },
  branch: (branch) => ({
    protected: branch.name === "main",
    ...(branch.name === "main"
      ? {}
      : {
          parent: "main",
          ttl: "7d",
        }),
  }),
})
