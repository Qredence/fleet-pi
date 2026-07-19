import { defineConfig } from "@neon/config/v1"

function chatFunctionEnv(name: string) {
  return process.env[name] ?? ""
}

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
        env: {
          FLEET_PI_CHAT_DATABASE_URL:
            chatFunctionEnv("FLEET_PI_CHAT_DATABASE_URL") ||
            chatFunctionEnv("DATABASE_URL"),
          NEON_AUTH_BASE_URL:
            chatFunctionEnv("NEON_AUTH_BASE_URL") ||
            chatFunctionEnv("NEON_AUTH_URL"),
          NEON_AUTH_JWKS_URL: chatFunctionEnv("NEON_AUTH_JWKS_URL"),
          NEON_AUTH_ISSUER: chatFunctionEnv("NEON_AUTH_ISSUER"),
          FLEET_PI_CHAT_RUNTIME_CORS_ORIGINS: chatFunctionEnv(
            "FLEET_PI_CHAT_RUNTIME_CORS_ORIGINS"
          ),
          GEMINI_API_KEY: chatFunctionEnv("GEMINI_API_KEY"),
        },
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
