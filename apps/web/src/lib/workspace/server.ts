import { constants } from "node:fs"
import { access, open, readdir } from "node:fs/promises"
import { basename, extname, isAbsolute, relative, resolve } from "node:path"
import { AGENT_WORKSPACE_DIRECTORY, seedAgentWorkspace } from "./layout"
import type {
  WorkspaceFileResponse,
  WorkspaceTreeNode,
  WorkspaceTreeResponse,
} from "../pi/chat-protocol"
import type { AppRuntimeContext } from "../desktop/server"

export async function ensureAgentWorkspace(context: AppRuntimeContext) {
  await seedAgentWorkspace(context.workspaceRoot)
}

export async function loadAgentWorkspaceTree(
  context: AppRuntimeContext
): Promise<WorkspaceTreeResponse> {
  const diagnostics: Array<string> = []

  try {
    await ensureAgentWorkspace(context)
  } catch (error) {
    const message = getWorkspaceErrorMessage(error, context.workspaceRoot)
    diagnostics.push(message)
    throw new Error(message)
  }

  await access(context.workspaceRoot, constants.R_OK)

  return {
    root: AGENT_WORKSPACE_DIRECTORY,
    nodes: await readTreeChildren(context.projectRoot, context.workspaceRoot),
    diagnostics,
  }
}

export async function loadAgentWorkspaceFile(
  context: AppRuntimeContext,
  filePath: string | null
): Promise<WorkspaceFileResponse> {
  await ensureAgentWorkspace(context)

  const resolvedPath = resolveWorkspacePath(context, filePath)
  const fileHandle = await open(resolvedPath, "r")

  try {
    const fileStats = await fileHandle.stat()
    if (!fileStats.isFile()) {
      throw new WorkspaceFileError("Workspace path is not a file.", 400)
    }

    const content = await fileHandle.readFile({ encoding: "utf8" })
    return {
      path: toWorkspacePath(context.projectRoot, resolvedPath),
      name: basename(resolvedPath),
      content,
      mediaType:
        extname(resolvedPath).toLowerCase() === ".md"
          ? "text/markdown"
          : "text/plain",
    }
  } finally {
    await fileHandle.close()
  }
}

async function readTreeChildren(
  projectRoot: string,
  directory: string
): Promise<Array<WorkspaceTreeNode>> {
  const entries = await readdir(directory, { withFileTypes: true })
  const sorted = entries.sort((left, right) => {
    if (left.isDirectory() !== right.isDirectory()) {
      return left.isDirectory() ? -1 : 1
    }
    return left.name.localeCompare(right.name)
  })

  return Promise.all(
    sorted.map(async (entry) => {
      const path = resolve(directory, entry.name)
      if (!entry.isDirectory()) {
        return {
          name: entry.name,
          path: toWorkspacePath(projectRoot, path),
          type: "file" as const,
        }
      }

      return {
        name: entry.name,
        path: toWorkspacePath(projectRoot, path),
        type: "directory" as const,
        children: await readTreeChildren(projectRoot, path),
      }
    })
  )
}

function getWorkspaceErrorMessage(error: unknown, workspaceRoot: string) {
  if (!isNodeError(error)) return String(error)
  if (error.code === "EROFS") {
    return `Cannot create ${workspaceRoot}: filesystem is read-only.`
  }
  if (error.code === "ENOENT") {
    return `Cannot create ${workspaceRoot}: parent filesystem path is unavailable or read-only.`
  }
  if (error.code === "EACCES" || error.code === "EPERM") {
    return `Cannot create ${workspaceRoot}: permission denied.`
  }
  return error.message
}

function toWorkspacePath(projectRoot: string, path: string) {
  return relative(projectRoot, path)
}

function resolveWorkspacePath(
  context: AppRuntimeContext,
  filePath: string | null
) {
  if (!filePath) {
    throw new WorkspaceFileError("Missing workspace file path.", 400)
  }
  if (isAbsolute(filePath)) {
    throw new WorkspaceFileError(
      "Workspace file path must be project-relative.",
      400
    )
  }
  if (
    filePath !== AGENT_WORKSPACE_DIRECTORY &&
    !filePath.startsWith(`${AGENT_WORKSPACE_DIRECTORY}/`)
  ) {
    throw new WorkspaceFileError(
      "Workspace file path is outside agent-workspace.",
      403
    )
  }

  const resolvedPath = resolve(context.projectRoot, filePath)
  const relativeToWorkspace = relative(context.workspaceRoot, resolvedPath)
  if (relativeToWorkspace === "") {
    throw new WorkspaceFileError(
      "Workspace path is a directory. Provide a path to a specific file.",
      400
    )
  }
  if (relativeToWorkspace.startsWith("..") || isAbsolute(relativeToWorkspace)) {
    throw new WorkspaceFileError(
      "Workspace file path is outside agent-workspace.",
      403
    )
  }

  return resolvedPath
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

export class WorkspaceFileError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}
