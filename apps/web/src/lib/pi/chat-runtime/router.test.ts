import { beforeEach, describe, expect, it, vi } from "vitest"
import { handleChatRuntimeRequest } from "./router"
import { postChatHandler } from "./handlers/post-chat"
import {
  EDGE_RATE_LIMIT_RULES,
  FLEET_PI_CHAT_START_RATE_LIMIT,
  resetEdgeRateLimitMemoryForTests,
} from "@/lib/deployment/edge-rate-limit"

vi.mock("./handlers/post-chat", () => ({
  postChatHandler: vi.fn(() => Promise.resolve(Response.json({ ok: true }))),
}))

describe("chat runtime CORS", () => {
  beforeEach(() => {
    resetEdgeRateLimitMemoryForTests()
    vi.mocked(postChatHandler).mockClear()
  })

  it("rejects an empty allowlist", async () => {
    delete process.env.FLEET_PI_CHAT_RUNTIME_CORS_ORIGINS
    const response = await handleChatRuntimeRequest(
      new Request("https://function.example/api/chat", {
        method: "OPTIONS",
        headers: { origin: "https://fleet-pi-web.example.workers.dev" },
      })
    )
    expect(response.status).toBe(503)
  })

  it("allows the production Cloudflare origin", async () => {
    process.env.FLEET_PI_CHAT_RUNTIME_CORS_ORIGINS =
      "https://fleet-pi-web.example.workers.dev"
    const response = await handleChatRuntimeRequest(
      new Request("https://function.example/api/chat", {
        method: "OPTIONS",
        headers: { origin: "https://fleet-pi-web.example.workers.dev" },
      })
    )
    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://fleet-pi-web.example.workers.dev"
    )
    delete process.env.FLEET_PI_CHAT_RUNTIME_CORS_ORIGINS
  })

  it("returns 429 for a chat burst before the turn handler", async () => {
    const limit = EDGE_RATE_LIMIT_RULES[FLEET_PI_CHAT_START_RATE_LIMIT].limit
    let response: Response | undefined
    for (let attempt = 0; attempt < limit + 1; attempt += 1) {
      response = await handleChatRuntimeRequest(
        new Request("https://function.example/api/chat", {
          method: "POST",
          headers: { "cf-connecting-ip": "203.0.113.9" },
        })
      )
    }

    expect(response?.status).toBe(429)
    await expect(response?.json()).resolves.toMatchObject({
      error: "rate-limited",
      rule: FLEET_PI_CHAT_START_RATE_LIMIT,
    })
    expect(postChatHandler).toHaveBeenCalledTimes(limit)
  })
})
