import { describe, expect, it } from "vitest"
import { handleChatRuntimeRequest } from "./router"

describe("chat runtime CORS", () => {
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
})
