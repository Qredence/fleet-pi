import { readdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import {
  formatProjectMemoryForStartupContext,
  readProjectMemoryIndex,
} from "./lib/workspace-memory-index"

const WORKSPACE_ROOT = "agent-workspace"
const CUSTOM_TYPE = "workspace-context"

export default function workspaceContextExtension(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (_event, ctx) => {
    const cwd = ctx.sessionManager.getCwd()
    const parts: Array<string> = ["[WORKSPACE CONTEXT]"]

    const identity = await readIdentity(cwd)
    if (identity) parts.push(`Agent: ${identity}`)

    parts.push(
      "Agent home: Fleet Pi lives in agent-workspace. Treat it as the primary surface for repo-local skills, tools, memory, plans, evals, artifacts, and runtime resource orientation; .pi/extensions are the executable runtime bridges that expose those workspace capabilities to Pi."
    )

    const activePlan = await readActivePlan(cwd)
    if (activePlan) parts.push(`Active plan: ${activePlan}`)

    parts.push(
      formatProjectMemoryForStartupContext(await readProjectMemoryIndex(cwd))
    )

    parts.push(
      "Mutation tiers: scratch/**/artifacts/traces|reports/**/memory/daily/** = free; memory/project|research|summaries/**/plans/**/skills/** = needs rationale; system/**/evals/** = protected."
    )
    parts.push(
      "Workspace tools: use workspace_index for orientation, workspace_write for durable workspace updates, resource_install for Pi skills/prompts/extensions/packages, project_inventory for app/resource overview, and web_fetch only when external context is needed."
    )
    parts.push(
      "On capability gaps: use questionnaire — state what's missing, list options (researcher subagent / web_fetch / gh skill install / user paste), wait for choice."
    )
    parts.push(
      "On resource install: use resource_install for Fleet Pi runtime resources. It writes to agent-workspace/pi; extensions/packages are staged unless the user explicitly asks to activate them. Start a new session or reload before relying on newly installed resources."
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

function extractTitle(content: string): string | undefined {
  for (const line of content.split("\n")) {
    const match = line.match(/^#\s+(.+)/)
    if (match) return match[1].trim()
  }
  return undefined
}
