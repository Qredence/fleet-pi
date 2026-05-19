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

const originalSecret = process.env.DAYTONA_WEBHOOK_SECRET

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.DAYTONA_WEBHOOK_SECRET
  } else {
    process.env.DAYTONA_WEBHOOK_SECRET = originalSecret
  }
  vi.clearAllMocks()
})

describe("daytonaWebhookHandler", () => {
  it("does not mutate sandbox cache when the webhook secret is unset", async () => {
    delete process.env.DAYTONA_WEBHOOK_SECRET
    getCachedUserSandbox.mockReturnValue({ sandboxId: "sandbox-1" })

    const response = await daytonaWebhookHandler({
      request: createWebhookRequest({ signature: "wrong" }),
    })

    expect(response.status).toBe(200)
    expect(getCachedUserSandbox).not.toHaveBeenCalled()
    expect(clearUserSandboxCache).not.toHaveBeenCalled()
  })

  it("does not mutate sandbox cache when the signature is invalid", async () => {
    process.env.DAYTONA_WEBHOOK_SECRET = "expected"
    getCachedUserSandbox.mockReturnValue({ sandboxId: "sandbox-1" })

    const response = await daytonaWebhookHandler({
      request: createWebhookRequest({ signature: "wrong" }),
    })

    expect(response.status).toBe(200)
    expect(getCachedUserSandbox).not.toHaveBeenCalled()
    expect(clearUserSandboxCache).not.toHaveBeenCalled()
  })

  it("clears cached sandbox state for verified error webhooks", async () => {
    process.env.DAYTONA_WEBHOOK_SECRET = "expected"
    getCachedUserSandbox.mockReturnValue({ sandboxId: "sandbox-1" })

    const response = await daytonaWebhookHandler({
      request: createWebhookRequest({ signature: "expected" }),
    })

    expect(response.status).toBe(200)
    expect(getCachedUserSandbox).toHaveBeenCalledWith("user-1")
    expect(clearUserSandboxCache).toHaveBeenCalledWith("user-1")
  })
})

function createWebhookRequest({ signature }: { signature?: string }) {
  return new Request("http://localhost:3000/api/webhooks/daytona", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(signature ? { "x-daytona-signature": signature } : {}),
    },
    body: JSON.stringify({
      event: "sandbox.error",
      sandboxName: "fleet-pi-user-user-1",
      state: "error",
    }),
  })
}
