import { describe, expect, it } from "vitest"
import { runWithChatAuthSurface } from "../../auth/chat-auth-surface"
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

  it("falls back to DATABASE_URL outside the Neon Function", () => {
    expect(
      resolveChatDatabaseUrl({
        DATABASE_URL: "postgres://neon",
      })
    ).toBe("postgres://neon")
  })

  it("ignores owner DATABASE_URL on the Neon Function", () => {
    const url = runWithChatAuthSurface("neon-function", () =>
      resolveChatDatabaseUrl({
        DATABASE_URL: "postgres://owner",
      })
    )
    expect(url).toBe("")
  })

  it("returns empty string when neither URL is set", () => {
    expect(resolveChatDatabaseUrl({})).toBe("")
  })
})
