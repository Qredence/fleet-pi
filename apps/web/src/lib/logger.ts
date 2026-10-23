import pino from "pino"
import { isHostedDeployment } from "@/lib/deployment/environment"

function isDev() {
  // Neon Functions and Cloudflare Workers must not use pino-pretty (not bundled).
  if (process.env.NEON_BRANCH?.trim()) return false
  if (isHostedDeployment()) return false
  return process.env.NODE_ENV !== "production"
}

export const redactPaths = [
  "password",
  "*.password",
  "*.*.password",
  "token",
  "*.token",
  "*.*.token",
  "apiKey",
  "*.apiKey",
  "*.*.apiKey",
  "secret",
  "*.secret",
  "*.*.secret",
  "authorization",
  "*.authorization",
  "*.*.authorization",
  "Authorization",
  "*.Authorization",
  "*.*.Authorization",
  "api_key",
  "*.api_key",
  "*.*.api_key",
  "api-key",
  '*["api-key"]',
  '*.*["api-key"]',
]

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: redactPaths,
    censor: "[Redacted]",
  },
  transport: isDev()
    ? {
        // Absolute path: pino 10.4 resolves bare targets from its caller
        // stack, which fails under Vite's SSR module runner in dev.
        target: process
          .getBuiltinModule("node:module")
          .createRequire(import.meta.url)
          .resolve("pino-pretty"),
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      }
    : undefined,
})

export function createRequestLogger(requestId: string) {
  return logger.child({ requestId })
}
