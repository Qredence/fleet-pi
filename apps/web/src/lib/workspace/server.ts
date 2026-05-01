import { constants } from "node:fs"
import { access, mkdir, open, readdir, writeFile } from "node:fs/promises"
import {
  basename,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path"
import type {
  WorkspaceFileResponse,
  WorkspaceTreeNode,
  WorkspaceTreeResponse,
} from "@/lib/pi/chat-protocol"
import { getRepoRoot } from "@/lib/pi/server"

export const AGENT_WORKSPACE_DIRECTORY = "agent-workspace"
export const AGENT_WORKSPACE_ROOT = join(
  getRepoRoot(),
  AGENT_WORKSPACE_DIRECTORY
)

const WORKSPACE_DIRECTORIES = [
  "system",
  "memory/daily",
  "memory/project",
  "memory/research",
  "skills/codebase-research",
  "skills/memory-synthesis",
  "artifacts/reports",
  "artifacts/diagrams",
  "artifacts/datasets",
  "artifacts/traces",
  "scratch/tmp",
]

const WORKSPACE_FILES = new Map<string, string>([
  [
    "system/identity.md",
    stub("Identity", "Define the agent workspace identity."),
  ],
  [
    "system/behavior.md",
    stub(
      "Behavior",
      "Capture behavioral defaults for agents using this workspace."
    ),
  ],
  [
    "system/constraints.md",
    stub("Constraints", "Record hard operating constraints and boundaries."),
  ],
  [
    "system/tool-policy.md",
    stub("Tool Policy", "Describe tool usage policy and safety expectations."),
  ],
  [
    "memory/daily/2026-05-01.md",
    stub("2026-05-01", "Daily notes and session observations."),
  ],
  [
    "memory/project/decisions.md",
    stub("Decisions", "Durable project decisions and rationale."),
  ],
  [
    "memory/project/architecture.md",
    stub("Architecture", "Architecture notes and system maps."),
  ],
  [
    "memory/project/open-questions.md",
    stub("Open Questions", "Unresolved questions and follow-up prompts."),
  ],
  [
    "memory/project/preferences.md",
    stub("Preferences", "User and project preferences to preserve."),
  ],
  ["memory/research/hermes.md", stub("Hermes", "Research notes for Hermes.")],
  [
    "memory/research/openclaw.md",
    stub("OpenClaw", "Research notes for OpenClaw."),
  ],
  ["memory/research/letta.md", stub("Letta", "Research notes for Letta.")],
  [
    "memory/research/factory.md",
    stub("Factory", "Research notes for Factory."),
  ],
  [
    "memory/research/evoskill.md",
    stub("EvoSkill", "Research notes for EvoSkill."),
  ],
  [
    "skills/codebase-research/skill.md",
    stub(
      "Codebase Research Skill",
      "Instructions for codebase research workflows."
    ),
  ],
  [
    "skills/codebase-research/examples.md",
    stub(
      "Codebase Research Examples",
      "Examples for using the codebase research skill."
    ),
  ],
  [
    "skills/codebase-research/evals.md",
    stub(
      "Codebase Research Evals",
      "Evaluation notes for the codebase research skill."
    ),
  ],
  [
    "skills/memory-synthesis/skill.md",
    stub(
      "Memory Synthesis Skill",
      "Instructions for synthesizing workspace memory."
    ),
  ],
  [
    "skills/memory-synthesis/changelog.md",
    stub(
      "Memory Synthesis Changelog",
      "Track changes to the memory synthesis skill."
    ),
  ],
])

function stub(title: string, purpose: string) {
  return `# ${title}\n\nPurpose: ${purpose}\n\nStatus: Seeded stub.\n`
}

export async function ensureAgentWorkspace() {
  await mkdir(AGENT_WORKSPACE_ROOT, { recursive: true })

  for (const directory of WORKSPACE_DIRECTORIES) {
    await mkdir(join(AGENT_WORKSPACE_ROOT, directory), { recursive: true })
  }

  for (const [filePath, contents] of WORKSPACE_FILES) {
    try {
      await writeFile(join(AGENT_WORKSPACE_ROOT, filePath), contents, {
        flag: "wx",
      })
    } catch (error) {
      if (!isNodeError(error) || error.code !== "EEXIST") throw error
    }
  }
}

export async function loadAgentWorkspaceTree(): Promise<WorkspaceTreeResponse> {
  const diagnostics: Array<string> = []

  try {
    await ensureAgentWorkspace()
  } catch (error) {
    const message = getWorkspaceErrorMessage(error)
    diagnostics.push(message)
    throw new Error(message)
  }

  await access(AGENT_WORKSPACE_ROOT, constants.R_OK)

  return {
    root: AGENT_WORKSPACE_DIRECTORY,
    nodes: await readTreeChildren(AGENT_WORKSPACE_ROOT),
    diagnostics,
  }
}

export async function loadAgentWorkspaceFile(
  filePath: string | null
): Promise<WorkspaceFileResponse> {
  await ensureAgentWorkspace()

  const resolvedPath = resolveWorkspacePath(filePath)
  const fileHandle = await open(resolvedPath, "r")

  try {
    const fileStats = await fileHandle.stat()
    if (!fileStats.isFile()) {
      throw new WorkspaceFileError("Workspace path is not a file.", 400)
    }

    const content = await fileHandle.readFile({ encoding: "utf8" })
    return {
      path: toWorkspacePath(resolvedPath),
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
      const path = join(directory, entry.name)
      if (!entry.isDirectory()) {
        return {
          name: entry.name,
          path: toWorkspacePath(path),
          type: "file" as const,
        }
      }

      return {
        name: entry.name,
        path: toWorkspacePath(path),
        type: "directory" as const,
        children: await readTreeChildren(path),
      }
    })
  )
}

function getWorkspaceErrorMessage(error: unknown) {
  if (!isNodeError(error)) return String(error)
  if (error.code === "EROFS") {
    return `Cannot create ${AGENT_WORKSPACE_ROOT}: filesystem is read-only.`
  }
  if (error.code === "ENOENT") {
    return `Cannot create ${AGENT_WORKSPACE_ROOT}: parent filesystem path is unavailable or read-only.`
  }
  if (error.code === "EACCES" || error.code === "EPERM") {
    return `Cannot create ${AGENT_WORKSPACE_ROOT}: permission denied.`
  }
  return error.message
}

function toWorkspacePath(path: string) {
  return relative(getRepoRoot(), path)
}

function resolveWorkspacePath(filePath: string | null) {
  if (!filePath) {
    throw new WorkspaceFileError("Missing workspace file path.", 400)
  }
  if (isAbsolute(filePath)) {
    throw new WorkspaceFileError(
      "Workspace file path must be repo-relative.",
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

  const resolvedPath = resolve(getRepoRoot(), filePath)
  const relativeToWorkspace = relative(AGENT_WORKSPACE_ROOT, resolvedPath)
  if (
    relativeToWorkspace === "" ||
    relativeToWorkspace.startsWith("..") ||
    isAbsolute(relativeToWorkspace)
  ) {
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
