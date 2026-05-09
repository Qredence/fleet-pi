import { constants } from "node:fs"
import { access, open, readdir, realpath, stat } from "node:fs/promises"
import { basename, extname, isAbsolute, relative, resolve } from "node:path"
import { AGENT_WORKSPACE_DIRECTORY, seedAgentWorkspace } from "./layout"
import type {
  WorkspaceFileResponse,
  WorkspaceTreeNode,
  WorkspaceTreeResponse,
} from "../pi/chat-protocol"
import type { AppRuntimeContext } from "../app-runtime"

const WORKSPACE_PREVIEW_MAX_BYTES = 256 * 1024
const BINARY_SAMPLE_BYTES = 8 * 1024

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

  const previewFile = await resolveWorkspacePreviewFile(context, filePath)
  const { fileHandle } = previewFile

  try {
    const fileStats = await fileHandle.stat()
    if (!fileStats.isFile()) {
      throw new WorkspaceFileError("Workspace path is not a file.", 400)
    }

    const baseResponse = {
      path: toWorkspacePath(context.projectRoot, previewFile.resolvedPath),
      name: basename(previewFile.resolvedPath),
      size: fileStats.size,
    }

    if (fileStats.size > WORKSPACE_PREVIEW_MAX_BYTES) {
      return {
        ...baseResponse,
        content: "",
        mediaType: "text/plain",
        status: "too-large",
      }
    }

    // Read file content first to check for binary
    const buffer = await fileHandle.readFile()

    // Check if file is binary by examining the buffer
    const bytesToCheck = Math.min(buffer.length, BINARY_SAMPLE_BYTES)
    const isBinary = buffer.subarray(0, bytesToCheck).includes(0)

    if (isBinary) {
      return {
        ...baseResponse,
        content: "",
        mediaType: "application/octet-stream",
        status: "unsupported",
      }
    }

    const content = buffer.toString("utf8")
    return {
      ...baseResponse,
      content,
      mediaType: getWorkspaceMediaType(previewFile.resolvedPath),
      status: "ok",
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

async function resolveWorkspacePreviewFile(
  context: AppRuntimeContext,
  filePath: string | null
) {
  const resolvedPath = resolveWorkspacePath(context, filePath)
  const realWorkspaceRoot = await realpath(context.workspaceRoot)

  // Check if file exists first to provide proper error handling
  try {
    await access(resolvedPath, constants.R_OK)
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new WorkspaceFileError("Workspace file was not found.", 404)
    }
    if (
      isNodeError(error) &&
      (error.code === "EACCES" || error.code === "EPERM")
    ) {
      throw new WorkspaceFileError(
        "Permission denied accessing workspace file.",
        403
      )
    }
    throw new WorkspaceFileError("Failed to access workspace file.", 500)
  }

  // Atomic validation: open the file first, then validate the resolved path
  const fileHandle = await open(resolvedPath, "r")
  let realPath: string

  try {
    // Get the file descriptor's real path atomically
    realPath = await realpath(resolvedPath)

    // Validate that the resolved path is still within the workspace
    if (!isPathInside(realWorkspaceRoot, realPath)) {
      throw new WorkspaceFileError(
        "Workspace file path is outside agent-workspace.",
        403
      )
    }

    // Double-check by verifying the file descriptor's stat matches
    const fileStats = await fileHandle.stat()
    const realStats = await stat(realPath)

    if (fileStats.ino !== realStats.ino || fileStats.dev !== realStats.dev) {
      throw new WorkspaceFileError(
        "Workspace file path validation failed.",
        403
      )
    }

    return { fileHandle, resolvedPath, realPath }
  } catch (error) {
    try {
      await fileHandle.close()
    } catch (closeError) {
      // Log close error but don't suppress the original error
      console.error(
        "Failed to close file handle during error handling:",
        closeError
      )
    }

    if (error instanceof WorkspaceFileError) {
      throw error
    }

    if (isNodeError(error)) {
      if (error.code === "ENOENT") {
        throw new WorkspaceFileError("Workspace file was not found.", 404)
      }
      if (error.code === "EACCES" || error.code === "EPERM") {
        throw new WorkspaceFileError(
          "Permission denied accessing workspace file.",
          403
        )
      }
    }

    // Always wrap unknown errors in a generic message
    throw new WorkspaceFileError("Failed to resolve workspace file.", 500)
  }
}

function getWorkspaceMediaType(
  filePath: string
): WorkspaceFileResponse["mediaType"] {
  return extname(filePath).toLowerCase() === ".md"
    ? "text/markdown"
    : "text/plain"
}

function isPathInside(parent: string, child: string) {
  const path = relative(parent, child)
  return path === "" || (!path.startsWith("..") && !isAbsolute(path))
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
