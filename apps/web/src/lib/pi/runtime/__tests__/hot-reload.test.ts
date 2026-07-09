import { beforeEach, describe, expect, it, vi } from "vitest"
import { retainPiRuntime } from "../../server"
import { hotReloadActiveRuntimesForUser } from "../hot-reload"

const mocks = vi.hoisted(() => ({
  applyRuntimeAuth: vi.fn(),
}))

vi.mock("../session-factory", () => ({
  applyRuntimeAuth: mocks.applyRuntimeAuth,
  createSessionServices: vi.fn(),
}))

describe("hotReloadActiveRuntimesForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("reloads BYOK only for matching user runtimes", async () => {
    const mockReload = vi.fn(async () => undefined)
    const createRuntime = (sessionId: string) =>
      ({
        session: { sessionId, sessionFile: `/tmp/${sessionId}.jsonl` },
        services: {
          settingsManager: { reload: mockReload },
        },
      }) as never

    const releaseA = retainPiRuntime(createRuntime("session-a"), "user-a")
    const releaseB = retainPiRuntime(createRuntime("session-b"), "user-b")

    try {
      await hotReloadActiveRuntimesForUser("user-a")

      expect(mockReload).toHaveBeenCalledTimes(1)
      expect(mocks.applyRuntimeAuth).toHaveBeenCalledTimes(1)
      expect(mocks.applyRuntimeAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          settingsManager: expect.objectContaining({ reload: mockReload }),
        }),
        { userId: "user-a" }
      )
    } finally {
      releaseA()
      releaseB()
    }
  })
})
