import pino from "pino"
import { isHostedDeployment } from "@/lib/deployment/environment"

function isDev() {
  // Cloudflare Workers must not use pino-pretty (not bundled).
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

const sensitiveFieldNames = new Set([
  "password",
  "token",
  "apiKey",
  "secret",
  "authorization",
  "Authorization",
  "api_key",
  "api-key",
])

function redactSensitiveFields<T>(
  value: T,
  seen = new WeakMap<object, unknown>()
): T {
  if (value === null || typeof value !== "object") return value

  const source = value as object
  const previous = seen.get(source)
  if (previous !== undefined) return previous as T

  if (Array.isArray(value)) {
    const redacted: Array<unknown> = []
    seen.set(source, redacted)
    for (const [index, item] of value.entries()) {
      redacted[index] = redactSensitiveFields(item, seen)
    }
    return redacted as T
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return value

  const redacted = Object.create(prototype) as Record<string, unknown>
  seen.set(source, redacted)
  for (const key of Object.keys(value)) {
    redacted[key] = sensitiveFieldNames.has(key)
      ? "[Redacted]"
      : redactSensitiveFields((value as Record<string, unknown>)[key], seen)
  }
  return redacted as T
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  formatters: {
    bindings: (bindings) => redactSensitiveFields(bindings),
    log: (object) => redactSensitiveFields(object),
  },
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
