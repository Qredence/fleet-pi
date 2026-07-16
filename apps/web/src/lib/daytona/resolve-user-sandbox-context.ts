import { executeCommand as defaultExecuteCommand } from "./client"
import {
  getUserSandbox as defaultGetUserSandbox,
  releaseUserSandbox,
} from "./user-sandbox"
import { SANDBOX_PROJECT_ROOT, SANDBOX_WORKSPACE_ROOT } from "./sandbox-prepare"
import type { Sandbox } from "@daytona/sdk"
import type { UserSandboxHandle } from "./user-sandbox"
import type { WorkspaceFS } from "@/lib/workspace/workspace-fs"
import { createSandboxWorkspaceFS } from "@/lib/workspace/workspace-fs"

export type SandboxSurface = "chat" | "workspace"

export interface ResolveUserSandboxContextParams {
  userId: string
  userEmail?: string
  apiKey: string
  surface: SandboxSurface
}

export interface UserSandboxContext {
  workspaceRoot: string
  sandboxProjectRoot: string
  sandbox: Sandbox
  handle: UserSandboxHandle
  workspaceFS: WorkspaceFS
  release: () => Promise<void>
}

/**
 * Cwd for Daytona-backed Pi builtins (bash, read/write/edit, grep, find, ls).
 * Always the agent-workspace volume — not the full sandbox project checkout.
 */
export function resolveSandboxToolCwd(
  context: Pick<UserSandboxContext, "workspaceRoot">
): string {
  return context.workspaceRoot
}

export interface UserSandboxContextDeps {
  getUserSandbox?: typeof defaultGetUserSandbox
  executeCommand?: typeof defaultExecuteCommand
}

export async function resolveUserSandboxContext(
  params: ResolveUserSandboxContextParams,
  deps: UserSandboxContextDeps = {}
): Promise<UserSandboxContext> {
  const getUserSandbox = deps.getUserSandbox ?? defaultGetUserSandbox
  const executeCommand = deps.executeCommand ?? defaultExecuteCommand

  const handle = await getUserSandbox({
    userId: params.userId,
    userEmail: params.userEmail,
    apiKey: params.apiKey,
  })
  const sandbox = handle.sandbox

  await ensureWorkspaceMounted(executeCommand, sandbox, params.surface)

  const workspaceFS = createSandboxWorkspaceFS({
    executeCommand: (cmd, cwd) => executeCommand(sandbox, cmd, cwd),
  })

  return {
    workspaceRoot: SANDBOX_WORKSPACE_ROOT,
    sandboxProjectRoot: SANDBOX_PROJECT_ROOT,
    sandbox,
    handle,
    workspaceFS,
    release: () => releaseUserSandbox(params.userId),
  }
}

async function ensureWorkspaceMounted(
  executeCommand: typeof defaultExecuteCommand,
  sandbox: Sandbox,
  surface: SandboxSurface
) {
  void surface
  await executeCommand(sandbox, `mkdir -p ${SANDBOX_WORKSPACE_ROOT}`)
}
