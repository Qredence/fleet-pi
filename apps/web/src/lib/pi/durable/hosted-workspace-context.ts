import { defineExtension, section } from "@earendil-works/pi-durable"

import {
  formatProjectMemoryForStartupContext,
  readProjectMemoryIndexWith,
} from "../workspace-memory-core"

import type { ProjectMemoryIndex } from "../workspace-memory-core"
import type { HostedSandboxPort } from "./hosted-sandbox-env"
import type { Extension } from "@earendil-works/pi-durable"

/** Name of the bundled hosted extension that renders workspace context. */
export const HOSTED_WORKSPACE_CONTEXT_EXTENSION = "workspace-context"

/** Policy files rendered into every hosted request, in this order. */
export const HOSTED_POLICY_FILES = [
  "AGENTS.md",
  "system/identity.md",
  "system/behavior.md",
  "system/constraints.md",
  "system/workspace-policy.md",
  "system/tool-policy.md",
  "system/self-improvement-policy.md",
] as const

const SKILLS_DIR = "pi/skills"
const PROMPTS_DIR = "pi/prompts"
const WORKSPACE_PREFIX = "agent-workspace/"

/** Size caps keep a large or hostile workspace from flooding the prompt. */
export const HOSTED_CONTEXT_LIMITS = {
  policyFileChars: 6000,
  policyTotalChars: 16000,
  skills: 50,
  skillDescriptionChars: 240,
} as const

/** Workspace-relative reads; paths never carry the `agent-workspace/` prefix. */
export type HostedWorkspaceReader = {
  /** File text, or undefined when missing or unreadable. */
  read: (path: string) => Promise<string | undefined>
  /** Direct children of `dir`; [] when missing or unreadable. */
  list: (dir: string) => Promise<Array<{ name: string; isDirectory: boolean }>>
}

export function hostedWorkspaceReader(
  port: HostedSandboxPort
): HostedWorkspaceReader {
  return {
    read: async (path) => {
      try {
        return await port.read(path)
      } catch {
        return undefined
      }
    },
    list: async (dir) => {
      if (!port.list) return []
      try {
        return await port.list(dir)
      } catch {
        return []
      }
    },
  }
}

type SkillSummary = { name: string; description: string; path: string }

type WorkspaceSnapshot = {
  policy: Array<{ path: string; text: string }>
  memory: ProjectMemoryIndex
  skills: Array<SkillSummary>
}

export type HostedWorkspaceContext = {
  extension: Extension
  /** Start a turn: remember the prompt for memory scoring, drop the cache. */
  beginTurn: (prompt: string) => void
  /** Drop the cache when a tool changed a file the sections render. */
  noteWrite: (path: string) => void
}

/**
 * Bundled hosted extension: renders the user's workspace policy, prompt-aware
 * project memory, and a skill index from their workspace. Only Markdown is
 * read; workspace code is never evaluated.
 */
export function createHostedWorkspaceContext(
  reader: HostedWorkspaceReader
): HostedWorkspaceContext {
  let prompt = ""
  let snapshot: Promise<WorkspaceSnapshot> | undefined
  const load = () => (snapshot ??= loadWorkspaceSnapshot(reader))

  const extension = defineExtension({
    name: HOSTED_WORKSPACE_CONTEXT_EXTENSION,
    sections: [
      section("workspace", async () =>
        renderWorkspaceSection((await load()).policy)
      ),
      section("project-memory", async () =>
        toToolPaths(
          formatProjectMemoryForStartupContext((await load()).memory, prompt)
        )
      ),
      section("workspace-skills", async () =>
        renderSkillsSection((await load()).skills)
      ),
    ],
  })

  return {
    extension,
    beginTurn(nextPrompt) {
      prompt = nextPrompt
      snapshot = undefined
    },
    noteWrite(path) {
      if (affectsWorkspaceContext(path)) snapshot = undefined
    },
  }
}

export function affectsWorkspaceContext(path: string): boolean {
  const normalized = normalizeWorkspacePath(path)
  return (
    normalized === "AGENTS.md" ||
    normalized.startsWith("system/") ||
    normalized.startsWith("memory/project/") ||
    normalized.startsWith(`${SKILLS_DIR}/`)
  )
}

async function loadWorkspaceSnapshot(
  reader: HostedWorkspaceReader
): Promise<WorkspaceSnapshot> {
  const [policy, memory, skills] = await Promise.all([
    loadPolicy(reader),
    readProjectMemoryIndexWith({
      readFile: (path) => reader.read(stripWorkspacePrefix(path)),
      listMarkdownFiles: async (dir) =>
        (await reader.list(stripWorkspacePrefix(dir)))
          .filter((entry) => !entry.isDirectory && entry.name.endsWith(".md"))
          .map((entry) => entry.name),
    }),
    loadSkills(reader),
  ])
  return { policy, memory, skills }
}

async function loadPolicy(reader: HostedWorkspaceReader) {
  const files = await Promise.all(
    HOSTED_POLICY_FILES.map(async (path) => ({
      path,
      text: (await reader.read(path))?.trim() ?? "",
    }))
  )
  const kept: Array<{ path: string; text: string }> = []
  let total = 0
  for (const file of files) {
    if (!file.text) continue
    const text = truncate(file.text, HOSTED_CONTEXT_LIMITS.policyFileChars)
    if (total + text.length > HOSTED_CONTEXT_LIMITS.policyTotalChars) break
    total += text.length
    kept.push({ path: file.path, text })
  }
  return kept
}

async function loadSkills(
  reader: HostedWorkspaceReader
): Promise<Array<SkillSummary>> {
  const dirs = (await reader.list(SKILLS_DIR))
    .filter((entry) => entry.isDirectory && isSafeSegment(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, HOSTED_CONTEXT_LIMITS.skills)
  const skills = await Promise.all(
    dirs.map(async (dir) => {
      const path = `${SKILLS_DIR}/${dir}/SKILL.md`
      const text = await reader.read(path)
      if (text === undefined) return undefined
      const frontmatter = parseFrontmatter(text)
      const description = frontmatter.description?.trim()
      if (!description) return undefined
      return {
        name: frontmatter.name?.trim() || dir,
        description: truncate(
          description,
          HOSTED_CONTEXT_LIMITS.skillDescriptionChars
        ),
        path,
      }
    })
  )
  return skills.filter((skill): skill is SkillSummary => skill !== undefined)
}

function renderWorkspaceSection(policy: WorkspaceSnapshot["policy"]) {
  const lines = [
    "Your durable workspace is the user's agent-workspace. Tool paths are relative to it (for example `memory/project/decisions.md`).",
    "Keep it accurate: follow the rules below, and record durable learnings in the narrowest canonical file.",
  ]
  if (policy.length === 0) {
    lines.push(
      "The workspace has no AGENTS.md or system/ policy yet. Read before writing, and ask before destructive changes."
    )
    return lines.join("\n")
  }
  for (const file of policy) {
    lines.push("", `--- ${file.path} ---`, file.text)
  }
  return lines.join("\n")
}

function renderSkillsSection(skills: Array<SkillSummary>) {
  if (skills.length === 0) return undefined
  return [
    "Workspace skills. When a task matches one, read its SKILL.md with the read tool and follow it.",
    ...skills.map(
      (skill) => `- ${skill.name}: ${skill.description} (${skill.path})`
    ),
  ].join("\n")
}

/** Memory text names `agent-workspace/...`; hosted tools take relative paths. */
function toToolPaths(text: string) {
  return text.replaceAll(WORKSPACE_PREFIX, "")
}

function stripWorkspacePrefix(path: string) {
  return path.startsWith(WORKSPACE_PREFIX)
    ? path.slice(WORKSPACE_PREFIX.length)
    : path
}

function normalizeWorkspacePath(path: string) {
  const relative = stripWorkspacePrefix(
    path.replace(/\\/g, "/").replace(/^\.\//, "")
  )
  return relative.startsWith("/home/daytona/agent-workspace/")
    ? relative.slice("/home/daytona/agent-workspace/".length)
    : relative
}

function isSafeSegment(name: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

/** Flat `key: value` YAML frontmatter, enough for skills and prompts. */
export function parseFrontmatter(
  text: string
): Partial<Record<string, string>> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)
  if (!match) return {}
  const fields: Partial<Record<string, string>> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line)
    if (field) fields[field[1]] = unquote(field[2].trim())
  }
  return fields
}

function stripFrontmatter(text: string) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "")
}

function unquote(value: string) {
  const quoted = /^(["'])(.*)\1$/.exec(value)
  return quoted ? quoted[2] : value
}

/**
 * Expands `/name args` from `pi/prompts/name.md`, mirroring Pi's local
 * template substitution (`$ARGUMENTS`, `$@`, `$1`…). Returns the prompt
 * unchanged when it is not a template invocation or the template is missing.
 */
export async function expandHostedPromptTemplate(
  prompt: string,
  reader: HostedWorkspaceReader
): Promise<string> {
  const match = /^\/([A-Za-z0-9][A-Za-z0-9._-]*)(?:\s+([\s\S]*))?$/.exec(prompt)
  if (!match) return prompt
  const template = await reader.read(`${PROMPTS_DIR}/${match[1]}.md`)
  if (template === undefined) return prompt
  const argsText = match.at(2)?.trim() ?? ""
  const args = argsText ? argsText.split(/\s+/) : []
  return stripFrontmatter(template)
    .replace(/\$(ARGUMENTS|@|\d+)/g, (_token, name: string) => {
      if (name === "ARGUMENTS" || name === "@") return argsText
      return args[Number(name) - 1] ?? ""
    })
    .trim()
}
