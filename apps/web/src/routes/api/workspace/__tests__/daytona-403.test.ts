import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { workspaceTreeHandler } from "@/routes/api/workspace/tree"
import { workspaceFileHandler } from "@/routes/api/workspace/file"
import { workspaceItemsHandler } from "@/routes/api/workspace/items"
import { workspaceItemHandler } from "@/routes/api/workspace/item"
import { workspaceSearchHandler } from "@/routes/api/workspace/search"
import { workspaceReindexHandler } from "@/routes/api/workspace/reindex"
import { workspaceHealthHandler } from "@/routes/api/workspace/health"
import { chatCommandsHandler } from "@/routes/api/chat/commands"
import { DaytonaCredentialRequiredError } from "@/lib/app-runtime"

const { resolveWorkspaceContextMock } = vi.hoisted(() => ({
  resolveWorkspaceContextMock: vi.fn(),
}))

const {
  withAuthenticatedChatRequestMock,
  isChatAuthRequiredMock,
  validateCsrfRequestMock,
} = vi.hoisted(() => ({
  withAuthenticatedChatRequestMock: vi.fn(),
  isChatAuthRequiredMock: vi.fn(() => false),
  validateCsrfRequestMock: vi.fn(() => ({ ok: true })),
}))

vi.mock("@/lib/auth/chat-api-auth", () => ({
  withAuthenticatedChatRequest: withAuthenticatedChatRequestMock,
  isChatAuthRequired: isChatAuthRequiredMock,
  issueCsrfToken: () => ({ token: "csrf-token", cookie: "csrf=token; Path=/" }),
}))

vi.mock("@/lib/auth/csrf", () => ({
  issueCsrfToken: () => ({ token: "csrf-token", cookie: "csrf=token; Path=/" }),
  validateCsrfRequest: validateCsrfRequestMock,
}))

vi.mock("@/lib/workspace/workspace-context", () => ({
  resolveWorkspaceContext: resolveWorkspaceContextMock,
}))

vi.mock("@/lib/workspace/workspace-query", () => ({
  WorkspaceQueryApiError: class WorkspaceQueryApiError extends Error {},
  createUnexpectedWorkspaceQueryErrorResponse: () => ({
    ok: false,
    code: "unexpected",
    message: "unexpected",
    diagnostics: [],
  }),
  createWorkspaceItemsResponse: vi.fn(),
  createWorkspaceItemDetailResponse: vi.fn(),
  createWorkspaceSearchResponse: vi.fn(),
  createWorkspaceReindexResponse: vi.fn(),
}))

vi.mock("@/lib/workspace/server", () => ({
  loadAgentWorkspaceTree: vi.fn(),
  loadAgentWorkspaceFile: vi.fn(),
  WorkspaceFileError: class WorkspaceFileError extends Error {
    readonly status = 400
  },
}))

vi.mock("@/lib/workspace/bootstrap-agent-workspace", () => ({
  loadAgentWorkspaceHealth: vi.fn(),
}))

vi.mock("@/lib/pi/runtime/command-catalog", () => ({
  loadChatCommands: vi.fn(),
}))

vi.mock("@/lib/pi/server", () => ({
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}))

const originalVercel = process.env.VERCEL

beforeEach(() => {
  process.env.VERCEL = "1"
  vi.clearAllMocks()
  withAuthenticatedChatRequestMock.mockImplementation(
    (
      _request: Request,
      handler: (ctx: {
        userId?: string
        authSession?: unknown
      }) => Promise<Response> | Response
    ) =>
      Promise.resolve(
        handler({
          userId: "user-1",
          authSession: { user: { id: "user-1", email: "user@example.test" } },
        })
      )
  )
  resolveWorkspaceContextMock.mockRejectedValue(
    new DaytonaCredentialRequiredError()
  )
})

afterEach(() => {
  if (originalVercel === undefined) {
    delete process.env.VERCEL
  } else {
    process.env.VERCEL = originalVercel
  }
  vi.clearAllMocks()
})

function makeRequest(path: string, init?: RequestInit) {
  return new Request(`http://localhost:3000${path}`, init)
}

describe("workspace routes return 403 + message when the Daytona credential is missing", () => {
  it("GET /api/workspace/tree → 403 + daytona_credential_required message", async () => {
    const response = await workspaceTreeHandler(
      makeRequest("/api/workspace/tree")
    )
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      message: "daytona_credential_required",
    })
  })

  it("GET /api/workspace/file → 403 + message (distinct from WorkspaceFileError mapping)", async () => {
    const response = await workspaceFileHandler(
      makeRequest("/api/workspace/file?path=agent-workspace/README.md")
    )
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      message: "daytona_credential_required",
    })
  })

  it("GET /api/workspace/items → 403, not 500", async () => {
    const response = await workspaceItemsHandler(
      makeRequest("/api/workspace/items")
    )
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      message: "daytona_credential_required",
    })
  })

  it("GET /api/workspace/item → 403, not 500", async () => {
    const response = await workspaceItemHandler(
      makeRequest("/api/workspace/item?id=some-id")
    )
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      message: "daytona_credential_required",
    })
  })

  it("GET /api/workspace/search → 403, not 500", async () => {
    const response = await workspaceSearchHandler(
      makeRequest("/api/workspace/search?q=memory")
    )
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      message: "daytona_credential_required",
    })
  })

  it("POST /api/workspace/reindex → 403 (CSRF 403 and rate-limit 429 stay distinct)", async () => {
    const response = await workspaceReindexHandler(
      makeRequest("/api/workspace/reindex", {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      })
    )
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      message: "daytona_credential_required",
    })
  })

  it("GET /api/chat/commands → 403 via getResponseStatus, not 500", async () => {
    const response = await chatCommandsHandler(
      makeRequest("/api/chat/commands")
    )
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      message: "daytona_credential_required",
    })
  })

  it("GET /api/workspace/health stays degraded 503", async () => {
    const response = await workspaceHealthHandler(
      makeRequest("/api/workspace/health")
    )
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      status: "degraded",
      workspaceAvailable: false,
      bootstrapComplete: false,
      projectionStatus: "degraded",
    })
  })
})
