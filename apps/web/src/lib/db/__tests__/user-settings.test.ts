import { beforeEach, describe, expect, it, vi } from "vitest"

import { loadUserProjectSettings } from "../user-settings"

const mocks = vi.hoisted(() => ({
  withChatPostgresTransaction: vi.fn(),
}))

vi.mock("../pi-session-mirror", () => ({
  withChatPostgresTransaction: mocks.withChatPostgresTransaction,
}))

describe("user-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.FLEET_PI_CHAT_DATABASE_URL = "postgres://example"
  })

  it("returns null when pi_user_settings is missing", async () => {
    mocks.withChatPostgresTransaction.mockRejectedValue({ code: "42P01" })

    await expect(loadUserProjectSettings("user-1")).resolves.toBeNull()
  })

  it("rethrows unexpected database errors", async () => {
    mocks.withChatPostgresTransaction.mockRejectedValue(
      new Error("connection failed")
    )

    await expect(loadUserProjectSettings("user-1")).rejects.toThrow(
      "connection failed"
    )
  })
})
