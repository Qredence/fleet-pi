import { constants } from "node:fs"
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import {
  WORKSPACE_PROJECTION_DATABASE_FILENAME,
  initializeWorkspaceProjection,
} from "../db/workspace-projection"
import {
  AGENT_WORKSPACE_DIRECTORY,
  WORKSPACE_MANIFEST_RELATIVE_PATH,
  WORKSPACE_POLICY_FILE_DEFINITIONS,
  WORKSPACE_REQUIRED_DIRECTORY_PATHS,
  WORKSPACE_SCRATCH_PROTECTION_PATHS,
  WORKSPACE_SECTION_DEFINITIONS,
  createDefaultWorkspaceManifest,
  toWorkspaceProjectPath,
  workspaceManifestSchema,
} from "./workspace-contract"
import type { AppRuntimeContext } from "../app-runtime"
import type {
  WorkspaceManifest,
  WorkspaceSectionKind,
  WorkspaceSectionName,
} from "./workspace-contract"

type WorkspaceHealthStatus = "ok" | "degraded"
type WorkspaceHealthSeverity = "warning" | "error"
type WorkspaceHealthScope =
  | "filesystem"
  | "manifest"
  | "section"
  | "policy"
  | "scratch"
  | "projection"

export type WorkspaceHealthDiagnostic = {
  scope: WorkspaceHealthScope
  code: string
  severity: WorkspaceHealthSeverity
  message: string
  path?: string
}

type WorkspacePathState = {
  path: string
  exists: boolean
  created: boolean
}

type WorkspaceDirectoryState = WorkspacePathState & {
  type: "directory"
}

type WorkspaceFileState = WorkspacePathState & {
  type: "file"
}

export type WorkspaceManifestState = WorkspaceFileState & {
  valid: boolean
  version: number | null
}

type WorkspaceSectionState = WorkspaceDirectoryState & {
  name: WorkspaceSectionName
  kind: WorkspaceSectionKind
}

type WorkspacePolicyState = WorkspaceFileState & {
  key: (typeof WORKSPACE_POLICY_FILE_DEFINITIONS)[number]["key"]
}

export type WorkspaceHealthResponse = {
  status: WorkspaceHealthStatus
  workspaceRoot: string
  workspacePath: typeof AGENT_WORKSPACE_DIRECTORY
  workspace: {
    path: string
    available: boolean
    created: boolean
  }
  bootstrap: {
    attempted: true
    complete: boolean
    createdPaths: Array<string>
    createdSections: Array<string>
    createdFiles: Array<string>
  }
  manifest: WorkspaceManifestState
  sections: {
    required: Array<WorkspaceSectionState>
    created: Array<string>
    missing: Array<string>
  }
  directories: {
    required: Array<WorkspaceDirectoryState>
    missing: Array<string>
  }
  policies: {
    files: Array<WorkspacePolicyState>
    missing: Array<string>
  }
  scratch: {
    path: string
    temporary: true
    protectionPaths: Array<string>
    protected: boolean
    missing: Array<string>
    created: Array<string>
  }
  projection: {
    path: string
    status: WorkspaceHealthStatus
    canonicalSourceOfTruth: true
    diagnostics: Array<WorkspaceHealthDiagnostic>
  }
  warnings: Array<string>
  diagnostics: Array<WorkspaceHealthDiagnostic>
}

const EMPTY_MANIFEST_STATE: WorkspaceManifestState = {
  path: toWorkspaceProjectPath(WORKSPACE_MANIFEST_RELATIVE_PATH),
  exists: false,
  created: false,
  type: "file",
  valid: false,
  version: null,
}

export async function bootstrapAgentWorkspace(
  context: AppRuntimeContext
): Promise<WorkspaceHealthResponse> {
  const diagnostics: Array<WorkspaceHealthDiagnostic> = []
  const warnings = new Set<string>()
  const createdPaths = new Set<string>()

  const workspace = await ensureWorkspaceRoot(
    context,
    diagnostics,
    createdPaths
  )
  if (!workspace.available) {
    return buildUnavailableHealth(context, workspace.created, diagnostics)
  }

  const sectionStates = await Promise.all(
    WORKSPACE_SECTION_DEFINITIONS.map((section) =>
      ensureDirectoryState(
        context,
        section.path,
        createdPaths,
        diagnostics,
        getScopeForSection(section.kind)
      ).then((state) => ({
        ...state,
        name: section.name,
        kind: section.kind,
      }))
    )
  )

  const directoryStates = await Promise.all(
    WORKSPACE_REQUIRED_DIRECTORY_PATHS.map((path) =>
      ensureDirectoryState(
        context,
        path,
        createdPaths,
        diagnostics,
        path === "indexes" ? "projection" : "section"
      )
    )
  )

  const manifest = await ensureManifestState(
    context,
    createdPaths,
    diagnostics,
    warnings
  )

  const policyStates = await Promise.all(
    WORKSPACE_POLICY_FILE_DEFINITIONS.map((policy) =>
      ensureFileState(
        context,
        policy.path,
        policy.contents,
        createdPaths,
        diagnostics,
        "policy"
      ).then((state) => ({
        ...state,
        key: policy.key,
      }))
    )
  )

  const scratchProtectionStates = await Promise.all(
    WORKSPACE_SCRATCH_PROTECTION_PATHS.map((path) =>
      ensureFileState(context, path, "", createdPaths, diagnostics, "scratch")
    )
  )

  const projectionDirectory = directoryStates.find(
    (directory) => directory.path === toWorkspaceProjectPath("indexes")
  )

  if (projectionDirectory?.exists) {
    try {
      initializeWorkspaceProjection(context)
    } catch (error) {
      diagnostics.push(
        createDiagnostic(
          "projection",
          "workspace-projection-init-failed",
          "error",
          getPathFailureMessage(
            error,
            toWorkspaceProjectPath(
              `indexes/${WORKSPACE_PROJECTION_DATABASE_FILENAME}`
            )
          ),
          toWorkspaceProjectPath(
            `indexes/${WORKSPACE_PROJECTION_DATABASE_FILENAME}`
          )
        )
      )
    }
  }

  const missingSections = sectionStates
    .filter((section) => !section.exists)
    .map((section) => section.path)
  const missingDirectories = directoryStates
    .filter((directory) => !directory.exists)
    .map((directory) => directory.path)
  const missingPolicies = policyStates
    .filter((policy) => !policy.exists)
    .map((policy) => policy.path)
  const missingScratchProtection = scratchProtectionStates
    .filter((file) => !file.exists)
    .map((file) => file.path)

  const projectionDiagnostics = diagnostics.filter(
    (diagnostic) => diagnostic.scope === "projection"
  )
  const sortedCreatedPaths = [...createdPaths].sort()
  const sortedWarnings = [...warnings].sort()
  const sortedDiagnostics = sortDiagnostics(diagnostics)
  const status = getHealthStatus(diagnostics, warnings, manifest)
  const createdFiles = sortedCreatedPaths.filter(
    (path) =>
      path.endsWith(".json") ||
      path.endsWith(".md") ||
      path.endsWith(".gitkeep")
  )

  return {
    status,
    workspaceRoot: context.workspaceRoot,
    workspacePath: AGENT_WORKSPACE_DIRECTORY,
    workspace: {
      path: AGENT_WORKSPACE_DIRECTORY,
      available: true,
      created: workspace.created,
    },
    bootstrap: {
      attempted: true,
      complete:
        manifest.valid &&
        missingSections.length === 0 &&
        missingDirectories.length === 0 &&
        missingPolicies.length === 0 &&
        missingScratchProtection.length === 0,
      createdPaths: sortedCreatedPaths,
      createdSections: sectionStates
        .filter((section) => section.created)
        .map((section) => section.path),
      createdFiles,
    },
    manifest,
    sections: {
      required: sectionStates,
      created: sectionStates
        .filter((section) => section.created)
        .map((section) => section.path),
      missing: missingSections,
    },
    directories: {
      required: directoryStates,
      missing: missingDirectories,
    },
    policies: {
      files: policyStates,
      missing: missingPolicies,
    },
    scratch: {
      path: toWorkspaceProjectPath("scratch"),
      temporary: true,
      protectionPaths: WORKSPACE_SCRATCH_PROTECTION_PATHS.map(
        toWorkspaceProjectPath
      ),
      protected: missingScratchProtection.length === 0,
      missing: missingScratchProtection,
      created: scratchProtectionStates
        .filter((file) => file.created)
        .map((file) => file.path),
    },
    projection: {
      path: toWorkspaceProjectPath("indexes"),
      status: projectionDiagnostics.length > 0 ? "degraded" : "ok",
      canonicalSourceOfTruth: true,
      diagnostics: sortDiagnostics(projectionDiagnostics),
    },
    warnings: sortedWarnings,
    diagnostics: sortedDiagnostics,
  }
}

export async function loadAgentWorkspaceHealth(
  context: AppRuntimeContext
): Promise<WorkspaceHealthResponse> {
  return bootstrapAgentWorkspace(context)
}

export function createWorkspaceHealthFailure(
  context: AppRuntimeContext,
  error: unknown
): WorkspaceHealthResponse {
  return buildUnavailableHealth(context, false, [
    createDiagnostic(
      "filesystem",
      "workspace-health-unexpected-failure",
      "error",
      error instanceof Error ? error.message : String(error),
      relative(context.projectRoot, context.workspaceRoot)
    ),
  ])
}

async function ensureWorkspaceRoot(
  context: AppRuntimeContext,
  diagnostics: Array<WorkspaceHealthDiagnostic>,
  createdPaths: Set<string>
) {
  try {
    const existing = await getExistingPathType(context.workspaceRoot)
    if (existing === "directory") {
      await access(context.workspaceRoot, constants.R_OK)
      return { available: true, created: false }
    }

    if (existing) {
      diagnostics.push(
        createDiagnostic(
          "filesystem",
          "workspace-root-not-directory",
          "error",
          `${AGENT_WORKSPACE_DIRECTORY} exists but is not a directory.`,
          AGENT_WORKSPACE_DIRECTORY
        )
      )
      return { available: false, created: false }
    }

    await mkdir(context.workspaceRoot, { recursive: true })
    createdPaths.add(AGENT_WORKSPACE_DIRECTORY)
    await access(context.workspaceRoot, constants.R_OK)
    return { available: true, created: true }
  } catch (error) {
    diagnostics.push(
      createDiagnostic(
        "filesystem",
        "workspace-root-unavailable",
        "error",
        getPathFailureMessage(error, AGENT_WORKSPACE_DIRECTORY),
        AGENT_WORKSPACE_DIRECTORY
      )
    )
    return { available: false, created: false }
  }
}

async function ensureDirectoryState(
  context: AppRuntimeContext,
  workspaceRelativePath: string,
  createdPaths: Set<string>,
  diagnostics: Array<WorkspaceHealthDiagnostic>,
  scope: WorkspaceHealthScope
): Promise<WorkspaceDirectoryState> {
  const absolutePath = join(context.workspaceRoot, workspaceRelativePath)
  const path = toWorkspaceProjectPath(workspaceRelativePath)

  try {
    const existing = await getExistingPathType(absolutePath)
    if (existing === "directory") {
      return {
        path,
        exists: true,
        created: false,
        type: "directory",
      }
    }

    if (existing) {
      diagnostics.push(
        createDiagnostic(
          scope,
          "workspace-path-not-directory",
          "error",
          `${path} exists but is not a directory.`,
          path
        )
      )
      return {
        path,
        exists: false,
        created: false,
        type: "directory",
      }
    }

    await mkdir(absolutePath, { recursive: true })
    createdPaths.add(path)
    return {
      path,
      exists: true,
      created: true,
      type: "directory",
    }
  } catch (error) {
    diagnostics.push(
      createDiagnostic(
        scope,
        "workspace-directory-init-failed",
        "error",
        getPathFailureMessage(error, path),
        path
      )
    )
    return {
      path,
      exists: false,
      created: false,
      type: "directory",
    }
  }
}

async function ensureFileState(
  context: AppRuntimeContext,
  workspaceRelativePath: string,
  contents: string,
  createdPaths: Set<string>,
  diagnostics: Array<WorkspaceHealthDiagnostic>,
  scope: WorkspaceHealthScope
): Promise<WorkspaceFileState> {
  const absolutePath = join(context.workspaceRoot, workspaceRelativePath)
  const path = toWorkspaceProjectPath(workspaceRelativePath)

  try {
    const existing = await getExistingPathType(absolutePath)
    if (existing === "file") {
      return {
        path,
        exists: true,
        created: false,
        type: "file",
      }
    }

    if (existing) {
      diagnostics.push(
        createDiagnostic(
          scope,
          "workspace-path-not-file",
          "error",
          `${path} exists but is not a file.`,
          path
        )
      )
      return {
        path,
        exists: false,
        created: false,
        type: "file",
      }
    }

    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, normalizeSeedContents(contents), {
      flag: "wx",
    })
    createdPaths.add(path)
    return {
      path,
      exists: true,
      created: true,
      type: "file",
    }
  } catch (error) {
    // Treat EEXIST as success: a concurrent bootstrap created the file between
    // our existence check and this write, so the file now exists as intended.
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return {
        path,
        exists: true,
        created: false,
        type: "file",
      }
    }
    diagnostics.push(
      createDiagnostic(
        scope,
        "workspace-file-init-failed",
        "error",
        getPathFailureMessage(error, path),
        path
      )
    )
    return {
      path,
      exists: false,
      created: false,
      type: "file",
    }
  }
}

async function ensureManifestState(
  context: AppRuntimeContext,
  createdPaths: Set<string>,
  diagnostics: Array<WorkspaceHealthDiagnostic>,
  warnings: Set<string>
): Promise<WorkspaceManifestState> {
  const manifestFile = await ensureFileState(
    context,
    WORKSPACE_MANIFEST_RELATIVE_PATH,
    JSON.stringify(createDefaultWorkspaceManifest(), null, 2),
    createdPaths,
    diagnostics,
    "manifest"
  )

  if (!manifestFile.exists) return EMPTY_MANIFEST_STATE

  try {
    const manifest = JSON.parse(
      await readFile(
        join(context.workspaceRoot, WORKSPACE_MANIFEST_RELATIVE_PATH),
        "utf8"
      )
    ) as WorkspaceManifest
    const parsed = workspaceManifestSchema.safeParse(manifest)
    if (!parsed.success) {
      const message =
        "Workspace manifest exists but does not match the typed contract."
      diagnostics.push(
        createDiagnostic(
          "manifest",
          "workspace-manifest-invalid",
          "warning",
          message,
          manifestFile.path
        )
      )
      warnings.add(message)
      return {
        ...manifestFile,
        valid: false,
        version:
          "version" in manifest && typeof manifest.version === "number"
            ? manifest.version
            : null,
      }
    }

    return {
      ...manifestFile,
      valid: true,
      version: parsed.data.version,
    }
  } catch (error) {
    const message = getPathFailureMessage(error, manifestFile.path)
    diagnostics.push(
      createDiagnostic(
        "manifest",
        "workspace-manifest-read-failed",
        "warning",
        message,
        manifestFile.path
      )
    )
    warnings.add(message)
    return {
      ...manifestFile,
      valid: false,
      version: null,
    }
  }
}

function buildUnavailableHealth(
  context: AppRuntimeContext,
  created: boolean,
  diagnostics: Array<WorkspaceHealthDiagnostic>
): WorkspaceHealthResponse {
  const sortedDiagnostics = sortDiagnostics(diagnostics)

  return {
    status: "degraded",
    workspaceRoot: context.workspaceRoot,
    workspacePath: AGENT_WORKSPACE_DIRECTORY,
    workspace: {
      path: AGENT_WORKSPACE_DIRECTORY,
      available: false,
      created,
    },
    bootstrap: {
      attempted: true,
      complete: false,
      createdPaths: [],
      createdSections: [],
      createdFiles: [],
    },
    manifest: EMPTY_MANIFEST_STATE,
    sections: {
      required: WORKSPACE_SECTION_DEFINITIONS.map((section) => ({
        path: toWorkspaceProjectPath(section.path),
        exists: false,
        created: false,
        type: "directory" as const,
        name: section.name,
        kind: section.kind,
      })),
      created: [],
      missing: WORKSPACE_SECTION_DEFINITIONS.map((section) =>
        toWorkspaceProjectPath(section.path)
      ),
    },
    directories: {
      required: WORKSPACE_REQUIRED_DIRECTORY_PATHS.map((directory) => ({
        path: toWorkspaceProjectPath(directory),
        exists: false,
        created: false,
        type: "directory" as const,
      })),
      missing: WORKSPACE_REQUIRED_DIRECTORY_PATHS.map(toWorkspaceProjectPath),
    },
    policies: {
      files: WORKSPACE_POLICY_FILE_DEFINITIONS.map((policy) => ({
        path: toWorkspaceProjectPath(policy.path),
        exists: false,
        created: false,
        type: "file" as const,
        key: policy.key,
      })),
      missing: WORKSPACE_POLICY_FILE_DEFINITIONS.map((policy) =>
        toWorkspaceProjectPath(policy.path)
      ),
    },
    scratch: {
      path: toWorkspaceProjectPath("scratch"),
      temporary: true,
      protectionPaths: WORKSPACE_SCRATCH_PROTECTION_PATHS.map(
        toWorkspaceProjectPath
      ),
      protected: false,
      missing: WORKSPACE_SCRATCH_PROTECTION_PATHS.map(toWorkspaceProjectPath),
      created: [],
    },
    projection: {
      path: toWorkspaceProjectPath("indexes"),
      status: "degraded",
      canonicalSourceOfTruth: true,
      diagnostics: sortDiagnostics(
        diagnostics.filter(
          (diagnostic) =>
            diagnostic.scope === "projection" ||
            diagnostic.scope === "filesystem"
        )
      ),
    },
    warnings: [],
    diagnostics: sortedDiagnostics,
  }
}

async function getExistingPathType(path: string) {
  try {
    const fileStats = await stat(path)
    if (fileStats.isDirectory()) return "directory"
    if (fileStats.isFile()) return "file"
    return "other"
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null
    }
    throw error
  }
}

function getScopeForSection(kind: WorkspaceSectionKind): WorkspaceHealthScope {
  if (kind === "temporary") return "scratch"
  if (kind === "projection") return "projection"
  return "section"
}

function getHealthStatus(
  diagnostics: Array<WorkspaceHealthDiagnostic>,
  warnings: Set<string>,
  manifest: WorkspaceManifestState
): WorkspaceHealthStatus {
  return diagnostics.length > 0 || warnings.size > 0 || !manifest.valid
    ? "degraded"
    : "ok"
}

function createDiagnostic(
  scope: WorkspaceHealthScope,
  code: string,
  severity: WorkspaceHealthSeverity,
  message: string,
  path?: string
): WorkspaceHealthDiagnostic {
  return {
    scope,
    code,
    severity,
    message,
    path,
  }
}

function getPathFailureMessage(error: unknown, path: string) {
  if (!isNodeError(error)) return `Cannot initialize ${path}: ${String(error)}`
  if (error.code === "EROFS") {
    return `Cannot initialize ${path}: filesystem is read-only.`
  }
  if (error.code === "ENOENT") {
    return `Cannot initialize ${path}: parent path is unavailable.`
  }
  if (error.code === "EACCES" || error.code === "EPERM") {
    return `Cannot initialize ${path}: permission denied.`
  }
  if (error.code === "ENOTDIR") {
    return `Cannot initialize ${path}: a parent path is not a directory.`
  }
  return `Cannot initialize ${path}: ${error.message}`
}

function normalizeSeedContents(contents: string) {
  if (!contents) return contents
  return contents.endsWith("\n") ? contents : `${contents}\n`
}

function sortDiagnostics(diagnostics: Array<WorkspaceHealthDiagnostic>) {
  return [...diagnostics].sort((left, right) => {
    const leftKey = `${left.scope}:${left.path ?? ""}:${left.code}:${left.message}`
    const rightKey = `${right.scope}:${right.path ?? ""}:${right.code}:${right.message}`

    return leftKey.localeCompare(rightKey)
  })
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}
