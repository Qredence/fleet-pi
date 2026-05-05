import { readdir, stat } from "node:fs/promises"
import { resolve } from "node:path"
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Type } from "typebox"

type WorkspaceEntryKind = "file" | "directory"

type WorkspaceEntry = {
  path: string
  exists: boolean
  kind: WorkspaceEntryKind
}

const WORKSPACE_ROOT = "agent-workspace"
const WORKSPACE_PURPOSE =
  "Repo-local agent memory, policies, plans, skills, artifacts, and scratch files."
const MUTATION_BOUNDARIES_NOTE =
  "See agent-workspace/system/workspace-policy.md for writable, rationale-required, and protected areas."

const START_HERE_ENTRIES = [
  fileEntry("agent-workspace/index.md"),
  fileEntry("agent-workspace/README.md"),
]

const SYSTEM_ENTRIES = [
  fileEntry("agent-workspace/system/identity.md"),
  fileEntry("agent-workspace/system/behavior.md"),
  fileEntry("agent-workspace/system/constraints.md"),
  fileEntry("agent-workspace/system/tool-policy.md"),
  fileEntry("agent-workspace/system/workspace-policy.md"),
  fileEntry("agent-workspace/system/self-improvement-policy.md"),
]

const MEMORY_ENTRIES = [
  fileEntry("agent-workspace/memory/project/architecture.md"),
  fileEntry("agent-workspace/memory/project/decisions.md"),
  fileEntry("agent-workspace/memory/project/preferences.md"),
  fileEntry("agent-workspace/memory/project/open-questions.md"),
  fileEntry("agent-workspace/memory/project/known-issues.md"),
]

const PLAN_ENTRIES = [
  directoryEntry("agent-workspace/plans/active"),
  directoryEntry("agent-workspace/plans/completed"),
  directoryEntry("agent-workspace/plans/abandoned"),
  fileEntry("agent-workspace/plans/backlog.md"),
]

const EVAL_ENTRIES = [
  fileEntry("agent-workspace/evals/agentic-coding.md"),
  fileEntry("agent-workspace/evals/memory-quality.md"),
  fileEntry("agent-workspace/evals/tool-use.md"),
  fileEntry("agent-workspace/evals/regression-checks.md"),
]

const ARTIFACT_ENTRIES = [
  directoryEntry("agent-workspace/artifacts/datasets"),
  directoryEntry("agent-workspace/artifacts/diagrams"),
  directoryEntry("agent-workspace/artifacts/reports"),
  directoryEntry("agent-workspace/artifacts/traces"),
]

const SCRATCH_ENTRIES = [directoryEntry("agent-workspace/scratch/tmp")]

export default function workspaceIndexExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "workspace_index",
    label: "Workspace Index",
    description:
      "Return a compact read-only map of Fleet Pi's agent-workspace layout and its key entry files.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const cwd = ctx.sessionManager.getCwd()
      const workspaceRoot = resolve(cwd, WORKSPACE_ROOT)
      const rootExists = await pathExists(workspaceRoot)

      const startHere = await resolveEntries(cwd, START_HERE_ENTRIES)
      const system = await resolveEntries(cwd, SYSTEM_ENTRIES)
      const memory = await resolveEntries(cwd, MEMORY_ENTRIES)
      const plans = await resolveEntries(cwd, PLAN_ENTRIES)
      const skills = await discoverSkills(cwd)
      const evals = await resolveEntries(cwd, EVAL_ENTRIES)
      const artifacts = await resolveEntries(cwd, ARTIFACT_ENTRIES)
      const scratch = await resolveEntries(cwd, SCRATCH_ENTRIES)

      const sections = [
        { title: "Start here", entries: startHere },
        { title: "System", entries: system },
        { title: "Memory", entries: memory },
        { title: "Plans", entries: plans },
        { title: "Skills", entries: skills },
        { title: "Evals", entries: evals },
        { title: "Artifacts", entries: artifacts },
        { title: "Scratch", entries: scratch },
      ]

      const missingPaths = sections
        .flatMap((section) => section.entries)
        .filter((entry) => !entry.exists)
        .map((entry) => entry.path)

      const summary = [
        "Fleet Pi agent workspace",
        WORKSPACE_PURPOSE,
        rootExists
          ? undefined
          : "Workspace root missing: agent-workspace/ (tool returned the expected layout with missing entries marked).",
        ...sections.flatMap((section) =>
          formatSection(section.title, section.entries)
        ),
        "Mutation boundaries:",
        `- ${MUTATION_BOUNDARIES_NOTE}`,
      ]
        .filter(Boolean)
        .join("\n")

      return {
        content: [{ type: "text", text: summary }],
        details: {
          workspaceRoot: WORKSPACE_ROOT,
          exists: rootExists,
          startHere,
          system,
          memory,
          plans,
          skills,
          evals,
          artifacts,
          scratch,
          missingPaths,
          mutationBoundariesNote: MUTATION_BOUNDARIES_NOTE,
        },
      }
    },
  })
}

function fileEntry(path: string): WorkspaceEntry {
  return { path, exists: false, kind: "file" }
}

function directoryEntry(path: string): WorkspaceEntry {
  return { path, exists: false, kind: "directory" }
}

async function resolveEntries(
  cwd: string,
  entries: Array<WorkspaceEntry>
): Promise<Array<WorkspaceEntry>> {
  return Promise.all(entries.map((entry) => resolveEntry(cwd, entry)))
}

async function resolveEntry(
  cwd: string,
  entry: WorkspaceEntry
): Promise<WorkspaceEntry> {
  const absolutePath = resolve(cwd, entry.path)
  const exists = await pathExists(absolutePath)
  return {
    ...entry,
    exists,
  }
}

async function discoverSkills(cwd: string): Promise<Array<WorkspaceEntry>> {
  const skillsDir = resolve(cwd, "agent-workspace/skills")
  if (!(await pathExists(skillsDir))) {
    return [directoryEntry("agent-workspace/skills")]
  }

  let directories: Array<string>
  try {
    const entries = await readdir(skillsDir, { withFileTypes: true })
    directories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return [directoryEntry("agent-workspace/skills")]
  }

  if (directories.length === 0) {
    return []
  }

  return resolveEntries(
    cwd,
    directories.map((name) =>
      fileEntry(`agent-workspace/skills/${name}/skill.md`)
    )
  )
}

async function pathExists(path: string) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

function formatSection(title: string, entries: Array<WorkspaceEntry>) {
  if (entries.length === 0) {
    return [`${title}:`, "- none discovered"]
  }

  return [`${title}:`, ...entries.map((entry) => `- ${formatEntry(entry)}`)]
}

function formatEntry(entry: WorkspaceEntry) {
  const suffix = entry.kind === "directory" ? "/" : ""
  return entry.exists
    ? `${entry.path}${suffix}`
    : `${entry.path}${suffix} (missing)`
}
