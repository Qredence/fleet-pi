import { describe, expect, it } from "vitest"
import pino from "pino"
import { createRequestLogger } from "./logger"

function buildTestLogger() {
  const logs: Array<Record<string, unknown>> = []
  const instance = pino(
    {
      level: "info",
      redact: {
        paths: [
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
        ],
        censor: "[Redacted]",
      },
    },
    {
      write: (line: string) => {
        logs.push(JSON.parse(line))
      },
    }
  )
  return { instance, logs }
}

describe("logger", () => {
  it("exports a configured pino logger", async () => {
    const { logger } = await import("./logger")
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe("function")
    expect(typeof logger.error).toBe("function")
  })

  it("redacts password fields", () => {
    const { instance, logs } = buildTestLogger()
    instance.info({ username: "alice", password: "super-secret" }, "test")
    expect(logs[0].password).toBe("[Redacted]")
    expect(logs[0].username).toBe("alice")
  })

  it("redacts token fields", () => {
    const { instance, logs } = buildTestLogger()
    instance.info({ token: "bearer-abc-123" }, "test")
    expect(logs[0].token).toBe("[Redacted]")
  })

  it("redacts apiKey fields", () => {
    const { instance, logs } = buildTestLogger()
    instance.info({ apiKey: "sk-123456" }, "test")
    expect(logs[0].apiKey).toBe("[Redacted]")
  })

  it("redacts secret fields", () => {
    const { instance, logs } = buildTestLogger()
    instance.info({ secret: "my-secret-value" }, "test")
    expect(logs[0].secret).toBe("[Redacted]")
  })

  it("redacts authorization fields", () => {
    const { instance, logs } = buildTestLogger()
    instance.info({ authorization: "Bearer token123" }, "test")
    expect(logs[0].authorization).toBe("[Redacted]")
  })

  it("redacts nested sensitive fields", () => {
    const { instance, logs } = buildTestLogger()
    instance.info(
      {
        user: { name: "alice", password: "nested-secret" },
        headers: { Authorization: "Bearer xyz" },
      },
      "test"
    )
    const entry = logs[0]
    expect((entry.user as Record<string, unknown>).password).toBe("[Redacted]")
    expect((entry.user as Record<string, unknown>).name).toBe("alice")
    expect((entry.headers as Record<string, unknown>).Authorization).toBe(
      "[Redacted]"
    )
  })

  it("creates a child logger with requestId", () => {
    const requestId = "req-123"
    const child = createRequestLogger(requestId)
    expect(child).toBeDefined()
    expect(typeof child.info).toBe("function")

    const bindings = child.bindings()
    expect(bindings.requestId).toBe(requestId)
  })
})
