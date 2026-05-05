import { readdir, readFile, stat } from "node:fs/promises"
import { resolve } from "node:path"
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"

const WORKSPACE_ROOT = "agent-workspace"
const CUSTOM_TYPE = "workspace-context"
const STUB_MARKER = "Seeded stub."

export default function workspaceContextExtension(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (_event, ctx) => {
    const cwd = ctx.sessionManager.getCwd()
    const parts: Array<string> = ["[WORKSPACE CONTEXT]"]

    const identity = await readIdentity(cwd)
    if (identity) parts.push(`Agent: ${identity}`)

    const activePlan = await readActivePlan(cwd)
    if (activePlan) parts.push(`Active plan: ${activePlan}`)

    const memoryStatus = await readMemoryStatus(cwd)
    if (memoryStatus) parts.push(`Memory: ${memoryStatus}`)

    parts.push(
      "Mutation tiers: scratch/**/artifacts/traces|reports/**/memory/daily/** = free; memory/project|research|summaries/**/plans/**/skills/** = needs rationale; system/**/evals/** = protected."
    )
    parts.push(
      "On capability gaps: use questionnaire — state what's missing, list options (researcher subagent / web_fetch / gh skill install / user paste), wait for choice."
    )
    parts.push(
      "On skill install: copy source file verbatim with workspace_write to agent-workspace/skills/<name>/SKILL.md — never summarize."
    )

    return {
      message: {
        customType: CUSTOM_TYPE,
        content: parts.join("\n"),
        display: false,
      },
    }
  })

  pi.on("context", (event) => {
    const messages = event.messages
    let lastWorkspaceContextIndex = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i] as { customType?: string }
      if (msg.customType === CUSTOM_TYPE) {
        lastWorkspaceContextIndex = i
        break
      }
    }

    if (lastWorkspaceContextIndex === -1) return undefined

    const filtered = messages.filter((msg, i) => {
      if (i === lastWorkspaceContextIndex) return true
      const custom = msg as { customType?: string }
      return custom.customType !== CUSTOM_TYPE
    })

    if (filtered.length === messages.length) return undefined
    return { messages: filtered }
  })
}

async function readIdentity(cwd: string): Promise<string | undefined> {
  try {
    const content = await readFile(
      resolve(cwd, WORKSPACE_ROOT, "system/identity.md"),
      "utf8"
    )
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith("#")) return trimmed
    }
  } catch {
    // file missing or unreadable
  }
  return undefined
}

async function readActivePlan(cwd: string): Promise<string | undefined> {
  try {
    const activeDir = resolve(cwd, WORKSPACE_ROOT, "plans/active")
    const entries = await readdir(activeDir, { withFileTypes: true })
    const plans = entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b))
    if (plans.length === 0) return undefined

    const planFile = plans[0]
    const content = await readFile(resolve(activeDir, planFile), "utf8")
    const title = extractTitle(content) ?? planFile.replace(/\.md$/, "")
    return `${title} (plans/active/${planFile})`
  } catch {
    // directory missing or unreadable
  }
  return undefined
}

async function readMemoryStatus(cwd: string): Promise<string | undefined> {
  const files = [
    "architecture.md",
    "decisions.md",
    "preferences.md",
    "open-questions.md",
    "known-issues.md",
  ]
  const projectDir = resolve(cwd, WORKSPACE_ROOT, "memory/project")
  const statuses: Array<string> = []

  for (const file of files) {
    try {
      const info = await stat(resolve(projectDir, file))
      if (info.size > 100) {
        const content = await readFile(resolve(projectDir, file), "utf8")
        if (!content.includes(STUB_MARKER)) {
          statuses.push(file.replace(/\.md$/, ""))
        }
      }
    } catch {
      // file missing
    }
  }

  if (statuses.length === 0) return undefined
  return `${statuses.join(", ")} (has content)`
}

function extractTitle(content: string): string | undefined {
  for (const line of content.split("\n")) {
    const match = line.match(/^#\s+(.+)/)
    if (match) return match[1].trim()
  }
  return undefined
}
