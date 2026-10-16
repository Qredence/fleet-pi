import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { workspaceTreeHandler } from "../../../routes/api/workspace/tree"
import {
  resetWorkspaceReindexRateLimitForTests,
  workspaceReindexCsrfHandler,
  workspaceReindexHandler,
} from "../../../routes/api/workspace/reindex"

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
  const originalHosted = process.env.FLEET_PI_DEPLOYMENT

  beforeEach(() => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    getSession.mockResolvedValue(null)
    resolveWorkspaceContext.mockResolvedValue({})
    createWorkspaceReindexResponse.mockResolvedValue({
      body: { outcome: "complete" },
      status: 200,
    })
    resetWorkspaceReindexRateLimitForTests()
  })

  afterEach(() => {
    if (originalHosted === undefined) delete process.env.FLEET_PI_DEPLOYMENT
    else process.env.FLEET_PI_DEPLOYMENT = originalHosted
    getSession.mockReset()
    resolveWorkspaceContext.mockReset()
    createWorkspaceReindexResponse.mockReset()
  })

  it("rejects anonymous workspace reads on Cloudflare", async () => {
    const response = await workspaceTreeHandler(
      new Request("https://fleet-pi-web.workers.dev/api/workspace/tree")
    )
    expect(response.status).toBe(401)
  })

  it("rejects anonymous workspace mutations on Cloudflare", async () => {
    const response = await workspaceReindexHandler(
      new Request("https://fleet-pi-web.workers.dev/api/workspace/reindex", {
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
      new Request("https://fleet-pi-web.workers.dev/api/workspace/tree")
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
      new Request("https://fleet-pi-web.workers.dev/api/workspace/reindex")
    )
    const { csrfToken } = (await tokenResponse.json()) as { csrfToken: string }
    const cookie = tokenResponse.headers.get("set-cookie")?.split(";")[0]

    const rejected = await workspaceReindexHandler(
      new Request("https://fleet-pi-web.workers.dev/api/workspace/reindex", {
        method: "POST",
      })
    )
    expect(rejected.status).toBe(403)

    const accepted = await workspaceReindexHandler(
      new Request("https://fleet-pi-web.workers.dev/api/workspace/reindex", {
        method: "POST",
        headers: {
          Cookie: cookie ?? "",
          Origin: "https://fleet-pi-web.workers.dev",
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
      new Request("https://fleet-pi-web.workers.dev/api/workspace/reindex", {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      })

    for (let index = 0; index < 5; index += 1) {
      expect((await workspaceReindexHandler(request())).status).toBe(200)
    }
    expect((await workspaceReindexHandler(request())).status).toBe(429)
  })
})
