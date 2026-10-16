import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  withAuthenticatedChatRequest: vi.fn(),
  enforceChatSessionOwnership: vi.fn(),
  deleteOwnedPiSession: vi.fn(),
  deleteHostedDurableSession: vi.fn(),
  isCloudflareDeployment: vi.fn(),
}))

vi.mock("@/lib/auth/chat-api-auth", () => ({
  withAuthenticatedChatRequest: mocks.withAuthenticatedChatRequest,
  enforceChatSessionOwnership: mocks.enforceChatSessionOwnership,
}))

vi.mock("@/lib/db/pi-session-deletion", () => ({
  deleteOwnedPiSession: mocks.deleteOwnedPiSession,
}))

vi.mock("@/lib/deployment/environment", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    isCloudflareDeployment: mocks.isCloudflareDeployment,
  }
})

vi.mock("@/lib/pi/durable/hosted-agent-turn", () => ({
  deleteHostedDurableSession: mocks.deleteHostedDurableSession,
  readHostedDurableSession: vi.fn(),
}))

vi.mock("@/lib/api-utils", () => ({
  wrapApiHandler: (handler: () => Promise<Response>) => handler(),
}))

vi.mock("@/lib/app-runtime", () => ({
  resolveAppRuntimeContext: vi.fn(() => ({})),
}))

vi.mock("@/lib/pi/server", () => ({
  hydrateChatSession: vi.fn(),
}))

describe("deleteChatSessionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isCloudflareDeployment.mockReturnValue(true)
    mocks.withAuthenticatedChatRequest.mockImplementation(
      async (
        _request: Request,
        handler: (input: { userId: string }) => unknown
      ) => handler({ userId: "user-1" })
    )
    mocks.enforceChatSessionOwnership.mockResolvedValue({ ok: true })
  })

  it("routes durable hosted sessions to the Durable Object delete endpoint", async () => {
    mocks.deleteHostedDurableSession.mockResolvedValue({ ok: true })
    const { deleteChatSessionHandler } = await import("../session")
    const response = await deleteChatSessionHandler(
      new Request("https://app.example/api/chat/session?sessionId=durable:9")
    )
    expect(response.status).toBe(200)
    expect(mocks.deleteHostedDurableSession).toHaveBeenCalledWith(
      "user-1",
      "durable:9"
    )
    expect(mocks.deleteOwnedPiSession).not.toHaveBeenCalled()
  })

  it("keeps JSONL deletes on the mirror path", async () => {
    mocks.isCloudflareDeployment.mockReturnValue(true)
    mocks.deleteOwnedPiSession.mockResolvedValue({
      deleted: true,
      sessionId: "legacy",
      sessionFile: "/tmp/session.jsonl",
    })
    const { deleteChatSessionHandler } = await import("../session")
    const response = await deleteChatSessionHandler(
      new Request(
        "https://app.example/api/chat/session?sessionId=legacy&sessionFile=%2Ftmp%2Fsession.jsonl"
      )
    )
    expect(response.status).toBe(200)
    expect(mocks.deleteOwnedPiSession).toHaveBeenCalled()
    expect(mocks.deleteHostedDurableSession).not.toHaveBeenCalled()
  })
})
