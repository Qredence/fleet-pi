import { createHmac } from "node:crypto"
import { afterEach, describe, expect, it, vi } from "vitest"

import { daytonaWebhookHandler } from "./daytona"

const { clearUserSandboxCache, getCachedUserSandbox } = vi.hoisted(() => ({
  clearUserSandboxCache: vi.fn(),
  getCachedUserSandbox: vi.fn(),
}))

vi.mock("@/lib/daytona/user-sandbox", () => ({
  clearUserSandboxCache,
  getCachedUserSandbox,
}))

const TEST_SECRET = "test-webhook-secret"
const originalSecret = process.env.DAYTONA_WEBHOOK_SECRET

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex")
}

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.DAYTONA_WEBHOOK_SECRET
  } else {
    process.env.DAYTONA_WEBHOOK_SECRET = originalSecret
  }
  vi.clearAllMocks()
})

function createWebhookRequest({
  secret = TEST_SECRET,
  signature,
  omitSignature = false,
  body,
  state = "error",
  event = "sandbox.error",
  sandboxName = "fleet-pi-user-user-1",
}: {
  secret?: string
  signature?: string
  omitSignature?: boolean
  body?: string
  state?: string
  event?: string
  sandboxName?: string
} = {}): Request {
  const payload = body ?? JSON.stringify({ event, sandboxName, state })
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (!omitSignature) {
    headers["x-daytona-signature"] = signature ?? sign(secret, payload)
  }
  return new Request("http://localhost:3000/api/webhooks/daytona", {
    method: "POST",
    headers,
    body: payload,
  })
}

describe("daytonaWebhookHandler", () => {
  it("accepts a valid HMAC and clears the cache for an error webhook", async () => {
    process.env.DAYTONA_WEBHOOK_SECRET = TEST_SECRET
    getCachedUserSandbox.mockReturnValue({ sandboxId: "sandbox-1" })

    const response = await daytonaWebhookHandler({
      request: createWebhookRequest(),
    })

    expect(response.status).toBe(200)
    expect(getCachedUserSandbox).toHaveBeenCalledWith("user-1")
    expect(clearUserSandboxCache).toHaveBeenCalledWith("user-1")
  })

  it("rejects a tampered payload with no side effects", async () => {
    process.env.DAYTONA_WEBHOOK_SECRET = TEST_SECRET
    getCachedUserSandbox.mockReturnValue({ sandboxId: "sandbox-1" })

    const original = JSON.stringify({
      event: "sandbox.error",
      sandboxName: "fleet-pi-user-user-1",
      state: "error",
    })
    const validSignature = sign(TEST_SECRET, original)
    const tampered = original.replace('"state":"error"', '"state":"started"')

    const response = await daytonaWebhookHandler({
      request: new Request("http://localhost:3000/api/webhooks/daytona", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-daytona-signature": validSignature,
        },
        body: tampered,
      }),
    })

    expect(response.status).toBe(200)
    expect(getCachedUserSandbox).not.toHaveBeenCalled()
    expect(clearUserSandboxCache).not.toHaveBeenCalled()
  })

  it("rejects a signature computed under a different secret", async () => {
    process.env.DAYTONA_WEBHOOK_SECRET = TEST_SECRET
    getCachedUserSandbox.mockReturnValue({ sandboxId: "sandbox-1" })

    const response = await daytonaWebhookHandler({
      request: createWebhookRequest({ secret: "another-secret" }),
    })

    expect(response.status).toBe(200)
    expect(getCachedUserSandbox).not.toHaveBeenCalled()
    expect(clearUserSandboxCache).not.toHaveBeenCalled()
  })

  it("rejects a request with a missing signature but still returns 200", async () => {
    process.env.DAYTONA_WEBHOOK_SECRET = TEST_SECRET
    getCachedUserSandbox.mockReturnValue({ sandboxId: "sandbox-1" })

    const response = await daytonaWebhookHandler({
      request: createWebhookRequest({ omitSignature: true }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: true })
    expect(getCachedUserSandbox).not.toHaveBeenCalled()
    expect(clearUserSandboxCache).not.toHaveBeenCalled()
  })

  it("logs a warning and performs no side effects when the secret is unset", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    delete process.env.DAYTONA_WEBHOOK_SECRET
    getCachedUserSandbox.mockReturnValue({ sandboxId: "sandbox-1" })

    const response = await daytonaWebhookHandler({
      request: createWebhookRequest(),
    })

    expect(response.status).toBe(200)
    expect(warnSpy).toHaveBeenCalled()
    expect(getCachedUserSandbox).not.toHaveBeenCalled()
    expect(clearUserSandboxCache).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it("does not clear the cache for a non-error event", async () => {
    process.env.DAYTONA_WEBHOOK_SECRET = TEST_SECRET
    getCachedUserSandbox.mockReturnValue({ sandboxId: "sandbox-1" })

    const response = await daytonaWebhookHandler({
      request: createWebhookRequest({
        state: "started",
        event: "sandbox.started",
      }),
    })

    expect(response.status).toBe(200)
    expect(getCachedUserSandbox).not.toHaveBeenCalled()
    expect(clearUserSandboxCache).not.toHaveBeenCalled()
  })

  it("does not clear the cache for an unprefixed sandboxName", async () => {
    process.env.DAYTONA_WEBHOOK_SECRET = TEST_SECRET
    getCachedUserSandbox.mockReturnValue({ sandboxId: "sandbox-1" })

    const response = await daytonaWebhookHandler({
      request: createWebhookRequest({ sandboxName: "unmanaged-sandbox" }),
    })

    expect(response.status).toBe(200)
    expect(getCachedUserSandbox).not.toHaveBeenCalled()
    expect(clearUserSandboxCache).not.toHaveBeenCalled()
  })

  it("does not clear the cache when no sandbox is cached", async () => {
    process.env.DAYTONA_WEBHOOK_SECRET = TEST_SECRET
    getCachedUserSandbox.mockReturnValue(undefined)

    const response = await daytonaWebhookHandler({
      request: createWebhookRequest(),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: true })
    expect(getCachedUserSandbox).toHaveBeenCalledWith("user-1")
    expect(clearUserSandboxCache).not.toHaveBeenCalled()
  })

  it("returns 500 with an error body for malformed JSON", async () => {
    process.env.DAYTONA_WEBHOOK_SECRET = TEST_SECRET

    const response = await daytonaWebhookHandler({
      request: createWebhookRequest({ omitSignature: true, body: "not-json" }),
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: "Webhook processing failed",
    })
    expect(clearUserSandboxCache).not.toHaveBeenCalled()
  })

  it("never logs the secret value in request logs", async () => {
    process.env.DAYTONA_WEBHOOK_SECRET = TEST_SECRET
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    getCachedUserSandbox.mockReturnValue({ sandboxId: "sandbox-1" })

    await daytonaWebhookHandler({ request: createWebhookRequest() })

    const calls = logSpy.mock.calls.map((args) => JSON.stringify(args))
    expect(calls.join("\n")).not.toContain(TEST_SECRET)
    logSpy.mockRestore()
  })
})
