import { describe, expect, it } from "vitest"
import { resolveChatDatabaseUrl } from "../chat-database-url"

describe("resolveChatDatabaseUrl", () => {
  it("prefers FLEET_PI_CHAT_DATABASE_URL over DATABASE_URL", () => {
    expect(
      resolveChatDatabaseUrl({
        FLEET_PI_CHAT_DATABASE_URL: "postgres://fleet",
        DATABASE_URL: "postgres://neon",
      })
    ).toBe("postgres://fleet")
  })

  it("falls back to DATABASE_URL for Neon Functions", () => {
    expect(
      resolveChatDatabaseUrl({
        DATABASE_URL: "postgres://neon",
      })
    ).toBe("postgres://neon")
  })

  it("returns empty string when neither URL is set", () => {
    expect(resolveChatDatabaseUrl({})).toBe("")
  })
})
