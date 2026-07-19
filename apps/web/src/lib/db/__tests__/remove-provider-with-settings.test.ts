import { beforeEach, describe, expect, it, vi } from "vitest"

import { removeProviderCredentialsAndSettings } from "../remove-provider-with-settings"

const mocks = vi.hoisted(() => ({
  withChatPostgresTransaction: vi.fn(),
}))

vi.mock("../pi-session-mirror", () => ({
  withChatPostgresTransaction: mocks.withChatPostgresTransaction,
}))

describe("removeProviderCredentialsAndSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("runs credential delete and settings upsert in one transaction", async () => {
    const query = vi.fn(() => Promise.resolve({ rows: [] }))
    mocks.withChatPostgresTransaction.mockImplementation(
      (operation: (client: { query: typeof query }) => Promise<void>) =>
        operation({ query })
    )

    await removeProviderCredentialsAndSettings("user-1", ["google"], {
      enabledModels: ["openai-chat-completions/model-a"],
    })

    expect(mocks.withChatPostgresTransaction).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledTimes(2)
    const calls = query.mock.calls as unknown as Array<[string]>
    expect(calls[0]?.[0]).toContain("DELETE FROM pi_user_providers")
    expect(calls[1]?.[0]).toContain("INSERT INTO pi_user_settings")
  })

  it("skips settings upsert when settings argument is undefined", async () => {
    const query = vi.fn(() => Promise.resolve({ rows: [] }))
    mocks.withChatPostgresTransaction.mockImplementation(
      (operation: (client: { query: typeof query }) => Promise<void>) =>
        operation({ query })
    )

    await removeProviderCredentialsAndSettings("user-1", ["google"], undefined)

    expect(query).toHaveBeenCalledTimes(1)
    const calls = query.mock.calls as unknown as Array<[string]>
    expect(calls[0]?.[0]).toContain("DELETE FROM pi_user_providers")
  })
})
