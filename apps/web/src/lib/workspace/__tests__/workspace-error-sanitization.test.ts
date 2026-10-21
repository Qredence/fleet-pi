import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  DaytonaCredentialRequiredError,
  RequestContextError,
} from "../../app-runtime"
import { indexWorkspaceProjection } from "../../db/workspace-indexer"
import {
  openWorkspaceProjection,
  seedWorkspaceProjectionConnection,
} from "../../db/workspace-projection"
import {
  bootstrapAgentWorkspace,
  loadAgentWorkspaceHealth,
} from "../bootstrap-agent-workspace"
import { WorkspaceFileError, loadAgentWorkspaceTree } from "../server"
import { createLocalWorkspaceFS } from "../workspace-fs"
import {
  WORKSPACE_PROJECTION_PROPAGATION,
  WorkspaceQueryApiError,
  createWorkspaceItemsResponse,
  createWorkspaceReindexResponse,
} from "../workspace-query"
import { createWorkspaceRouteErrorResponse } from "../workspace-route-errors"
import type { AppRuntimeContext } from "../../app-runtime"
import type * as WorkspaceProjection from "../../db/workspace-projection"
import type * as BootstrapWorkspace from "../bootstrap-agent-workspace"

vi.mock("../../db/workspace-indexer", () => ({
  indexWorkspaceProjection: vi.fn(),
}))
vi.mock("../../db/workspace-projection", async (importOriginal) => ({
  ...(await importOriginal<typeof WorkspaceProjection>()),
  openWorkspaceProjection: vi.fn(),
  seedWorkspaceProjectionConnection: vi.fn(),
}))
vi.mock("../bootstrap-agent-workspace", async (importOriginal) => ({
  ...(await importOriginal<typeof BootstrapWorkspace>()),
  bootstrapAgentWorkspace: vi.fn(),
  loadAgentWorkspaceHealth: vi.fn(),
}))

const privateMessage =
  "provider-token-sentinel /private/server/path SQL failure"
const { bootstrapAgentWorkspace: realBootstrap } = await vi.importActual<
  typeof BootstrapWorkspace
>("../bootstrap-agent-workspace")
let context: AppRuntimeContext
let health: Awaited<ReturnType<typeof realBootstrap>>
let log: ReturnType<typeof vi.spyOn>

beforeEach(async () => {
  vi.resetAllMocks()
  log = vi.spyOn(console, "error").mockImplementation(() => {})
  const projectRoot = await mkdtemp(join(tmpdir(), "workspace-errors-"))
  context = { projectRoot, workspaceRoot: join(projectRoot, "agent-workspace") }
  health = await realBootstrap(context)
  vi.mocked(loadAgentWorkspaceHealth).mockResolvedValue(health)
  vi.mocked(bootstrapAgentWorkspace).mockResolvedValue(health)
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(context.projectRoot, { recursive: true, force: true })
})

describe("workspace error sanitization", () => {
  it.each([
    [new DaytonaCredentialRequiredError(), 403, "daytona_credential_required"],
    [
      new WorkspaceFileError("Missing workspace file path.", 400),
      400,
      "Missing workspace file path.",
    ],
    [
      new RequestContextError(privateMessage, 503),
      503,
      "Workspace operation failed.",
    ],
    [new Error(privateMessage), 500, "Workspace query failed."],
    [privateMessage, 500, "Workspace query failed."],
  ])("sanitizes route errors %#", async (error, status, message) => {
    const response = createWorkspaceRouteErrorResponse(error, context)
    expect(response.status).toBe(status)
    const body = await response.json()
    expect(body.message).toBe(message)
    expect(JSON.stringify(body)).not.toContain(privateMessage)
    if (status === 500)
      expect(log).toHaveBeenCalledWith(expect.any(String), error)
  })

  it("sanitizes typed error bodies and both diagnostic arrays", async () => {
    const diagnostics = [
      { code: "workspace-projection-open-failed", message: privateMessage },
    ]
    const error = new WorkspaceQueryApiError(503, {
      workspaceRoot: context.workspaceRoot,
      workspacePath: "agent-workspace",
      propagation: WORKSPACE_PROJECTION_PROPAGATION,
      ok: false,
      code: "workspace-projection-unavailable",
      message: privateMessage,
      diagnostics,
      projection: {
        status: "degraded",
        path: "agent-workspace/indexes",
        diagnostics,
      },
    })
    expect(error.message).not.toContain(privateMessage)
    expect(JSON.stringify(error.body)).not.toContain(privateMessage)
    const response = createWorkspaceRouteErrorResponse(error, context)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual(error.body)
  })

  it("keeps raw projection health diagnostics out of query and reindex failures", async () => {
    health.projection.status = "degraded"
    health.projection.diagnostics = [
      {
        scope: "projection",
        code: "workspace-projection-init-failed",
        severity: "error",
        message: privateMessage,
      },
    ]
    await expect(createWorkspaceItemsResponse(context)).rejects.toMatchObject({
      status: 503,
    })
    try {
      await createWorkspaceItemsResponse(context)
    } catch (error) {
      expect(error).toBeInstanceOf(WorkspaceQueryApiError)
      expect(
        JSON.stringify((error as WorkspaceQueryApiError).body)
      ).not.toContain(privateMessage)
    }
    const result = await createWorkspaceReindexResponse(context)
    expect(result.status).toBe(503)
    expect(JSON.stringify(result.body)).not.toContain(privateMessage)
  })

  it("sanitizes projection seeding failures and closes the connection", async () => {
    const connection = { close: vi.fn(), db: {} } as unknown as ReturnType<
      typeof openWorkspaceProjection
    >
    vi.mocked(openWorkspaceProjection).mockReturnValue(connection)
    const failure = new Error(privateMessage)
    vi.mocked(seedWorkspaceProjectionConnection).mockImplementation(() => {
      throw failure
    })
    const error = await createWorkspaceItemsResponse(context).catch(
      (caught: unknown) => caught
    )
    expect(error).toBeInstanceOf(WorkspaceQueryApiError)
    expect(
      JSON.stringify((error as WorkspaceQueryApiError).body)
    ).not.toContain(privateMessage)
    expect(connection.close).toHaveBeenCalledOnce()
    expect(log).toHaveBeenCalledWith(expect.any(String), failure)
  })

  it("sanitizes thrown reindex failures", async () => {
    const failure = new Error(privateMessage)
    vi.mocked(indexWorkspaceProjection).mockRejectedValue(failure)
    const result = await createWorkspaceReindexResponse(context)
    expect(result.status).toBe(503)
    expect(JSON.stringify(result.body)).not.toContain(privateMessage)
    expect(log).toHaveBeenCalledWith(expect.any(String), failure)
  })

  it("sanitizes diagnostics from a partial reindex", async () => {
    vi.mocked(indexWorkspaceProjection).mockResolvedValue({
      outcome: "degraded",
      recordedAt: new Date().toISOString(),
      counts: {
        scanned: 1,
        inserted: 0,
        updated: 0,
        unchanged: 0,
        deleted: 0,
        reactivated: 0,
      },
      diagnostics: [
        {
          code: "workspace-file-read-failed",
          severity: "error",
          path: "agent-workspace/test.md",
          message: privateMessage,
        },
      ],
    })
    const result = await createWorkspaceReindexResponse(context)
    expect(result.body.completion).toBe("partial")
    expect(JSON.stringify(result.body)).not.toContain(privateMessage)
  })

  it("does not promote health diagnostics into tree exceptions", async () => {
    health.workspace.available = false
    health.diagnostics = [
      {
        scope: "filesystem",
        code: "workspace-root-unavailable",
        severity: "error",
        message: privateMessage,
      },
    ]
    await expect(loadAgentWorkspaceTree(context)).rejects.toMatchObject({
      status: 503,
      message: "Workspace is unavailable.",
    })
  })

  it.each([
    new Error(privateMessage),
    privateMessage,
    Object.assign(new Error(privateMessage), { code: "EIO" }),
  ])("sanitizes bootstrap failures %#", async (failure) => {
    const result = await realBootstrap({
      ...context,
      workspaceFS: {
        ...createLocalWorkspaceFS(),
        stat: vi.fn().mockRejectedValue(failure),
      },
    })
    expect(result.workspace.available).toBe(false)
    expect(JSON.stringify(result)).not.toContain(privateMessage)
    expect(log).toHaveBeenCalledWith(expect.any(String), failure)
  })
})
