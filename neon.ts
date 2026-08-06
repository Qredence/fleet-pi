import { defineConfig } from "@neon/config/v1"

function chatFunctionEnv(name: string) {
  return process.env[name] ?? ""
}

export default defineConfig({
  // Managed Auth for identity; keep Data API off — Fleet Pi uses the
  // server/Function path (JWKS-verified JWT + fleet_pi_app), not browser→REST.
  auth: true,
  dataApi: false,
  preview: {
    aiGateway: true,
    functions: {
      chat: {
        name: "Fleet Pi Chat Runtime",
        source: "./functions/chat.ts",
        dev: { port: 8787 },
        env: {
          FLEET_PI_CHAT_DATABASE_URL:
            chatFunctionEnv("FLEET_PI_CHAT_DATABASE_URL") ||
            chatFunctionEnv("DATABASE_URL"),
          // Neon Functions have no persistent repo; default the Pi project root
          // to an ephemeral writable location so sessions/workspace can mkdir.
          FLEET_PI_REPO_ROOT: chatFunctionEnv("FLEET_PI_REPO_ROOT") || "/tmp",
          NEON_AUTH_BASE_URL:
            chatFunctionEnv("NEON_AUTH_BASE_URL") ||
            chatFunctionEnv("NEON_AUTH_URL"),
          NEON_AUTH_JWKS_URL: chatFunctionEnv("NEON_AUTH_JWKS_URL"),
          NEON_AUTH_ISSUER: chatFunctionEnv("NEON_AUTH_ISSUER"),
          FLEET_PI_CHAT_RUNTIME_CORS_ORIGINS: chatFunctionEnv(
            "FLEET_PI_CHAT_RUNTIME_CORS_ORIGINS"
          ),
          NEON_AI_GATEWAY_TOKEN: chatFunctionEnv("NEON_AI_GATEWAY_TOKEN"),
          NEON_AI_GATEWAY_BASE_URL: chatFunctionEnv("NEON_AI_GATEWAY_BASE_URL"),
          // BYOK provider credential encryption (AES-GCM) on the runtime.
          BETTER_AUTH_SECRET: chatFunctionEnv("BETTER_AUTH_SECRET"),
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
