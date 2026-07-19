import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { workspaceTreeHandler } from "../../routes/api/workspace/tree"
import {
  resetWorkspaceReindexRateLimitForTests,
  workspaceReindexCsrfHandler,
  workspaceReindexHandler,
} from "../../routes/api/workspace/reindex"

const { createWorkspaceReindexResponse, getSession, resolveWorkspaceContext } =
  vi.hoisted(() => ({
    createWorkspaceReindexResponse: vi.fn(),
    getSession: vi.fn(),
    resolveWorkspaceContext: vi.fn(),
  }))

vi.mock("@/lib/auth/server", () => ({
  auth: { api: { getSession } },
}))

vi.mock("@/lib/workspace/workspace-context", () => ({
  resolveWorkspaceContext,
}))

vi.mock("@/lib/workspace/workspace-query", () => ({
  createWorkspaceReindexResponse,
  createUnexpectedWorkspaceQueryErrorResponse: vi.fn(() => ({})),
}))

describe("workspace deployment auth", () => {
  const originalVercel = process.env.VERCEL

  beforeEach(() => {
    process.env.VERCEL = "1"
    getSession.mockResolvedValue(null)
    resolveWorkspaceContext.mockResolvedValue({})
    createWorkspaceReindexResponse.mockResolvedValue({
      body: { outcome: "complete" },
      status: 200,
    })
    resetWorkspaceReindexRateLimitForTests()
  })

  afterEach(() => {
    if (originalVercel === undefined) delete process.env.VERCEL
    else process.env.VERCEL = originalVercel
    getSession.mockReset()
    resolveWorkspaceContext.mockReset()
    createWorkspaceReindexResponse.mockReset()
  })

  it("rejects anonymous workspace reads on Vercel", async () => {
    const response = await workspaceTreeHandler(
      new Request("https://fleet-pi-web.vercel.app/api/workspace/tree")
    )
    expect(response.status).toBe(401)
  })

  it("rejects anonymous workspace mutations on Vercel", async () => {
    const response = await workspaceReindexHandler(
      new Request("https://fleet-pi-web.vercel.app/api/workspace/reindex", {
        method: "POST",
      })
    )
    expect(response.status).toBe(401)
  })

  it("passes the authenticated identity into workspace resolution", async () => {
    const session = {
      user: { id: "user-1", email: "user@example.test" },
      session: { id: "session-1", userId: "user-1" },
    }
    getSession.mockResolvedValue(session)

    await workspaceTreeHandler(
      new Request("https://fleet-pi-web.vercel.app/api/workspace/tree")
    )

    expect(resolveWorkspaceContext).toHaveBeenCalledWith(
      expect.any(Request),
      session.user
    )
    expect(getSession).toHaveBeenCalledTimes(1)
  })

  it("requires CSRF for cookie-authenticated reindex and uses user scope", async () => {
    const session = {
      user: { id: "user-1", email: "user@example.test" },
      session: { id: "session-1", userId: "user-1" },
    }
    getSession.mockResolvedValue(session)
    const tokenResponse = await workspaceReindexCsrfHandler(
      new Request("https://fleet-pi-web.vercel.app/api/workspace/reindex")
    )
    const { csrfToken } = (await tokenResponse.json()) as { csrfToken: string }
    const cookie = tokenResponse.headers.get("set-cookie")?.split(";")[0]

    const rejected = await workspaceReindexHandler(
      new Request("https://fleet-pi-web.vercel.app/api/workspace/reindex", {
        method: "POST",
      })
    )
    expect(rejected.status).toBe(403)

    const accepted = await workspaceReindexHandler(
      new Request("https://fleet-pi-web.vercel.app/api/workspace/reindex", {
        method: "POST",
        headers: {
          Cookie: cookie ?? "",
          Origin: "https://fleet-pi-web.vercel.app",
          "X-Fleet-CSRF-Token": csrfToken,
        },
      })
    )
    expect(accepted.status).toBe(200)
    expect(resolveWorkspaceContext).toHaveBeenLastCalledWith(
      expect.any(Request),
      session.user
    )
  })

  it("rate limits repeated authenticated reindex requests", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-1", email: "user@example.test" },
    })
    const request = () =>
      new Request("https://fleet-pi-web.vercel.app/api/workspace/reindex", {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      })

    for (let index = 0; index < 5; index += 1) {
      expect((await workspaceReindexHandler(request())).status).toBe(200)
    }
    expect((await workspaceReindexHandler(request())).status).toBe(429)
  })
})
