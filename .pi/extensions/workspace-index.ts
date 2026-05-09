import { readdir, stat } from "node:fs/promises"
import { resolve } from "node:path"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { Type } from "typebox"
import {
  formatProjectMemoryForWorkspaceIndex,
  readProjectMemoryIndex,
} from "./lib/workspace-memory-index"

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

const PI_EXTENSION_ENTRIES = [
  fileEntry(".pi/extensions/project-inventory.ts"),
  fileEntry(".pi/extensions/resource-install.ts"),
  fileEntry(".pi/extensions/workspace-index.ts"),
  fileEntry(".pi/extensions/workspace-write.ts"),
  fileEntry(".pi/extensions/workspace-context.ts"),
  fileEntry(".pi/extensions/web-fetch.ts"),
  fileEntry(".pi/extensions/bedrock-bearer-auth.ts"),
  fileEntry(".pi/extensions/vendor/filechanges/index.ts"),
  fileEntry(".pi/extensions/vendor/subagents/index.ts"),
]

const RUNTIME_TOOLS = [
  "workspace_index",
  "workspace_write",
  "resource_install",
  "project_inventory",
  "web_fetch",
  "questionnaire",
  "filechanges",
  "subagent",
]

const PLAN_ENTRIES = [
  directoryEntry("agent-workspace/plans/active"),
  directoryEntry("agent-workspace/plans/completed"),
  directoryEntry("agent-workspace/plans/abandoned"),
  fileEntry("agent-workspace/plans/backlog.md"),
]

const WORKSPACE_PI_RESOURCE_ENTRIES = [
  directoryEntry("agent-workspace/pi/skills"),
  directoryEntry("agent-workspace/pi/prompts"),
  directoryEntry("agent-workspace/pi/extensions/staged"),
  directoryEntry("agent-workspace/pi/extensions/enabled"),
  directoryEntry("agent-workspace/pi/packages"),
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
      const projectMemory = await readProjectMemoryIndex(cwd)
      const memory = projectMemory.canonical.map((file) => ({
        path: file.path,
        exists: file.exists,
        kind: "file" as const,
      }))
      const piExtensions = await resolveEntries(cwd, PI_EXTENSION_ENTRIES)
      const workspacePiResources = await resolveEntries(
        cwd,
        WORKSPACE_PI_RESOURCE_ENTRIES
      )
      const plans = await resolveEntries(cwd, PLAN_ENTRIES)
      const skills = await discoverSkills(cwd)
      const evals = await resolveEntries(cwd, EVAL_ENTRIES)
      const artifacts = await resolveEntries(cwd, ARTIFACT_ENTRIES)
      const scratch = await resolveEntries(cwd, SCRATCH_ENTRIES)

      const sections = [
        { title: "Start here", entries: startHere },
        { title: "System", entries: system },
        { title: "Pi extensions", entries: piExtensions },
        { title: "Workspace Pi resources", entries: workspacePiResources },
        { title: "Plans", entries: plans },
        { title: "Skills", entries: skills },
        { title: "Evals", entries: evals },
        { title: "Artifacts", entries: artifacts },
        { title: "Scratch", entries: scratch },
      ]

      const missingPaths = sections
        .flatMap((section) => section.entries)
        .concat(memory)
        .filter((entry) => !entry.exists)
        .map((entry) => entry.path)

      const summary = [
        "Fleet Pi agent workspace",
        WORKSPACE_PURPOSE,
        "Agent home: use agent-workspace as the primary surface for Fleet Pi skills, tools, memory, plans, evals, artifacts, and runtime resource orientation.",
        "Workspace-native installs: resource_install writes Pi skills, prompts, staged/enabled extensions, and package bundles under agent-workspace/pi. Start a new session or reload after installing.",
        rootExists
          ? undefined
          : "Workspace root missing: agent-workspace/ (tool returned the expected layout with missing entries marked).",
        ...sections.flatMap((section) =>
          formatSection(section.title, section.entries)
        ),
        ...formatProjectMemoryForWorkspaceIndex(projectMemory),
        "Runtime tools:",
        ...RUNTIME_TOOLS.map((tool) => `- ${tool}`),
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
          projectMemory,
          orphanedMemory: projectMemory.orphaned,
          piExtensions,
          workspacePiResources,
          runtimeTools: RUNTIME_TOOLS,
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
      fileEntry(`agent-workspace/skills/${name}/SKILL.md`)
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
