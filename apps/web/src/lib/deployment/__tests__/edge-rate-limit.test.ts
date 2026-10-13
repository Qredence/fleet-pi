import { describe, expect, it } from "vitest"
import {
  EDGE_RATE_LIMIT_RULES,
  FLEET_PI_CHAT_START_RATE_LIMIT,
  enforceNamedEdgeRateLimit,
  rateLimitRuleForRequest,
  resetEdgeRateLimitMemoryForTests,
} from "../edge-rate-limit"

describe("rateLimitRuleForRequest", () => {
  it("applies chat burst limits to new and resume POST routes", () => {
    expect(
      rateLimitRuleForRequest(
        new Request("https://fleet-pi.example/api/chat/new", { method: "POST" })
      )
    ).toBe(FLEET_PI_CHAT_START_RATE_LIMIT)
    expect(
      rateLimitRuleForRequest(
        new Request("https://fleet-pi.example/api/chat/resume", {
          method: "POST",
        })
      )
    ).toBe(FLEET_PI_CHAT_START_RATE_LIMIT)
    expect(
      rateLimitRuleForRequest(
        new Request("https://fleet-pi.example/api/chat/durable-spike", {
          method: "POST",
        })
      )
    ).toBe(FLEET_PI_CHAT_START_RATE_LIMIT)
  })
})

describe("enforceNamedEdgeRateLimit", () => {
  it("returns 429 from the named chat rule before the handler runs", async () => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    resetEdgeRateLimitMemoryForTests()
    const request = new Request("https://fleet-pi.example/api/chat", {
      method: "POST",
      headers: { "cf-connecting-ip": "203.0.113.5" },
    })
    const limit = EDGE_RATE_LIMIT_RULES[FLEET_PI_CHAT_START_RATE_LIMIT].limit

    let limited: Response | undefined
    for (let attempt = 0; attempt < limit + 1; attempt += 1) {
      limited = await enforceNamedEdgeRateLimit({ request, now: 1_000 })
    }

    expect(limited?.status).toBe(429)
    await expect(limited?.json()).resolves.toMatchObject({
      error: "rate-limited",
      rule: FLEET_PI_CHAT_START_RATE_LIMIT,
    })
    delete process.env.FLEET_PI_DEPLOYMENT
  })
})
