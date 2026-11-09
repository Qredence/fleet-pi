import { existsSync, realpathSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

import { AGENT_WORKSPACE_DIRECTORY } from "./workspace/workspace-contract"

import type { WorkspaceFS } from "./workspace/workspace-fs"

const WORKSPACE_MARKER = "pnpm-workspace.yaml"

/**
 * Nearest ancestor of `start` (inclusive) that holds the pnpm workspace
 * marker, or `start` itself when none does. Scripts and tests that run from
 * `apps/web` must still resolve the repo root, or they create a stray
 * `apps/web/agent-workspace/`.
 */
export function findRepoRoot(start: string): string {
  let dir = resolve(start)
  for (;;) {
    if (existsSync(join(dir, WORKSPACE_MARKER))) return dir
    const parent = dirname(dir)
    if (parent === dir) return resolve(start)
    dir = parent
  }
}

export function getDefaultProjectRoot() {
  return realpathSync(
    resolve(process.env.FLEET_PI_REPO_ROOT ?? findRepoRoot(process.cwd()))
  )
}

export type AppRuntimeContext = {
  projectRoot: string
  workspaceRoot: string
  workspaceFS?: WorkspaceFS
}

export function resolveAppRuntimeContext(): AppRuntimeContext {
  const projectRoot = getDefaultProjectRoot()
  return {
    projectRoot,
    workspaceRoot: join(projectRoot, AGENT_WORKSPACE_DIRECTORY),
  }
}

export class RequestContextError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

export class DaytonaCredentialRequiredError extends RequestContextError {
  constructor() {
    super("daytona_credential_required", 403)
  }
}

export function getResponseStatus(error: unknown) {
  return error instanceof RequestContextError ? error.status : 500
}
