import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { getDefaultProjectRoot } from "../app-runtime"
import { AGENT_WORKSPACE_DIRECTORY } from "../workspace/layout"
import { DESKTOP_AUTH_HEADER } from "./types"

export type AppRuntimeContext = {
  isDesktop: boolean
  projectRoot: string
  workspaceRoot: string
  workspaceId?: string
  sessionDir?: string
}

type ChatSessionMetadata = {
  sessionFile?: string
  sessionId?: string
}

type StoredWorkspace = {
  projectRoot: string
  workspaceRoot: string
  workspaceId: string
  activeSession?: ChatSessionMetadata
}

type DesktopStateFile = {
  activeProjectRoot?: string
  recentProjects?: Array<StoredWorkspace>
}

const DESKTOP_STATE_PATH_ENV = "FLEET_PI_DESKTOP_STATE_PATH"
const DESKTOP_AUTH_TOKEN_ENV = "FLEET_PI_DESKTOP_AUTH_TOKEN"

export class RequestContextError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

function defaultRuntimeContext(): AppRuntimeContext {
  const projectRoot = getDefaultProjectRoot()
  return {
    isDesktop: false,
    projectRoot,
    workspaceRoot: join(projectRoot, AGENT_WORKSPACE_DIRECTORY),
  }
}

function readDesktopState(statePath: string): DesktopStateFile {
  if (!existsSync(statePath)) return {}

  try {
    return JSON.parse(readFileSync(statePath, "utf8")) as DesktopStateFile
  } catch {
    return {}
  }
}

export function resolveAppRuntimeContext(
  request: Request,
  options: { requireProject?: boolean } = {}
): AppRuntimeContext {
  const statePath = process.env[DESKTOP_STATE_PATH_ENV]
  const requestToken = process.env[DESKTOP_AUTH_TOKEN_ENV]
  if (!statePath || !requestToken) {
    return defaultRuntimeContext()
  }

  if (request.headers.get(DESKTOP_AUTH_HEADER) !== requestToken) {
    throw new RequestContextError(
      "Desktop request token missing or invalid.",
      401
    )
  }

  const state = readDesktopState(statePath)
  const active = state.activeProjectRoot
    ? state.recentProjects?.find(
        (project) => project.projectRoot === state.activeProjectRoot
      )
    : undefined

  if (!active) {
    if (options.requireProject === false) {
      const projectRoot = getDefaultProjectRoot()
      return {
        isDesktop: true,
        projectRoot,
        workspaceRoot: join(projectRoot, AGENT_WORKSPACE_DIRECTORY),
      }
    }

    throw new RequestContextError("No desktop project is active.", 409)
  }

  return {
    isDesktop: true,
    projectRoot: active.projectRoot,
    workspaceRoot: active.workspaceRoot,
    workspaceId: active.workspaceId,
    sessionDir: join(
      dirname(statePath),
      "workspaces",
      active.workspaceId,
      "sessions"
    ),
  }
}

export function getResponseStatus(error: unknown) {
  return error instanceof RequestContextError ? error.status : 500
}
