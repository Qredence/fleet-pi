import { describe, expect, it, vi } from "vitest"

import {
  resolveSandboxToolCwd,
  resolveUserSandboxContext,
} from "./resolve-user-sandbox-context"
import { SANDBOX_PROJECT_ROOT, SANDBOX_WORKSPACE_ROOT } from "./sandbox-prepare"
import type * as UserSandboxModule from "./user-sandbox"

const { mockExecuteCommand, mockGetUserSandbox, mockReleaseUserSandbox } =
  vi.hoisted(() => ({
    mockExecuteCommand: vi.fn(),
    mockGetUserSandbox: vi.fn(),
    mockReleaseUserSandbox: vi.fn(),
  }))

vi.mock("./user-sandbox", async (importOriginal) => {
  const actual = await importOriginal<typeof UserSandboxModule>()
  return {
    ...actual,
    getUserSandbox: mockGetUserSandbox,
    releaseUserSandbox: mockReleaseUserSandbox,
  }
})

describe("resolveUserSandboxContext", () => {
  it("mounts workspace and returns sandbox context for chat surface", async () => {
    const sandbox = { id: "sandbox-1" }
    mockGetUserSandbox.mockResolvedValue({
      sandbox,
      userId: "user-1",
      volumeId: "vol-1",
      volumeName: "fleet-pi-ws-user-1",
      sandboxId: "sandbox-1",
    })
    mockExecuteCommand.mockResolvedValue({ exitCode: 0, result: "" })
    mockReleaseUserSandbox.mockResolvedValue(undefined)

    const context = await resolveUserSandboxContext(
      {
        userId: "user-1",
        userEmail: "user@example.test",
        apiKey: "daytona-key",
        surface: "chat",
      },
      { executeCommand: mockExecuteCommand }
    )

    expect(mockGetUserSandbox).toHaveBeenCalledWith({
      userId: "user-1",
      userEmail: "user@example.test",
      apiKey: "daytona-key",
    })
    expect(mockExecuteCommand).toHaveBeenCalledWith(
      sandbox,
      `mkdir -p ${SANDBOX_WORKSPACE_ROOT}`
    )
    expect(context.workspaceRoot).toBe(SANDBOX_WORKSPACE_ROOT)
    expect(context.sandboxProjectRoot).toBe(SANDBOX_PROJECT_ROOT)
    expect(context.sandbox).toBe(sandbox)
    expect(context.workspaceFS).toBeDefined()

    await context.release()
    expect(mockReleaseUserSandbox).toHaveBeenCalledWith("user-1")
  })

  it("resolves Daytona tool cwd to the agent-workspace volume", () => {
    expect(
      resolveSandboxToolCwd({ workspaceRoot: SANDBOX_WORKSPACE_ROOT })
    ).toBe(SANDBOX_WORKSPACE_ROOT)
    expect(SANDBOX_WORKSPACE_ROOT).not.toBe(SANDBOX_PROJECT_ROOT)
  })
})
