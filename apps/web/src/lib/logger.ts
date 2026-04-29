import pino from "pino"

function isDev() {
  return process.env.NODE_ENV !== "production"
}

const redactPaths = [
  "password",
  "*.password",
  "**.password",
  "token",
  "*.token",
  "**.token",
  "apiKey",
  "*.apiKey",
  "**.apiKey",
  "secret",
  "*.secret",
  "**.secret",
  "authorization",
  "*.authorization",
  "**.authorization",
  "Authorization",
  "*.Authorization",
  "**.Authorization",
  "api_key",
  "*.api_key",
  "**.api_key",
  "api-key",
  "*.api-key",
  "**.api-key",
]

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: redactPaths,
    censor: "[Redacted]",
  },
  transport: isDev()
    ? {
        target: "pino-pretty",
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
