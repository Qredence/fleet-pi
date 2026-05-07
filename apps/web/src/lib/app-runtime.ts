import { realpathSync } from "node:fs"
import { join, resolve } from "node:path"
import { AGENT_WORKSPACE_DIRECTORY } from "./workspace/layout"

const DEFAULT_PROJECT_ROOT = process.cwd()

export function getDefaultProjectRoot() {
  return realpathSync(
    resolve(process.env.FLEET_PI_REPO_ROOT ?? DEFAULT_PROJECT_ROOT)
  )
}

export type AppRuntimeContext = {
  projectRoot: string
  workspaceRoot: string
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

export function getResponseStatus(error: unknown) {
  return error instanceof RequestContextError ? error.status : 500
}
