import { readdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import {
  formatProjectMemoryForStartupContext,
  readProjectMemoryIndex,
} from "./lib/workspace-memory-index"
import { keepLastCustomType } from "./lib/context-filter"

const WORKSPACE_ROOT = "agent-workspace"
const CUSTOM_TYPE = "workspace-context"

export default function workspaceContextExtension(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (_event, ctx) => {
    const cwd = ctx.sessionManager.getCwd()
    const parts: Array<string> = ["[WORKSPACE CONTEXT]"]

    const workspaceAgents = await readWorkspaceAgents(cwd)
    if (workspaceAgents) {
      parts.push(workspaceAgents)
    } else {
      const identity = await readIdentity(cwd)
      if (identity) parts.push(`Agent: ${identity}`)

      parts.push(
        "Agent home: Fleet Pi lives in agent-workspace. Treat it as the primary surface for repo-local skills, tools, memory, plans, evals, artifacts, and runtime resource orientation; .pi/extensions are the executable runtime bridges that expose those workspace capabilities to Pi."
      )
      parts.push(
        "Mutation tiers: scratch/**/artifacts/traces|reports/**/memory/daily/** = free; memory/project|research|summaries/**/plans/**/skills/** = needs rationale; system/**/evals/** = protected."
      )
      parts.push(
        "Workspace tools: use workspace_index for orientation, workspace_write for durable workspace updates, resource_install for Pi skills/prompts/extensions/packages, project_inventory for app/resource overview, and web_fetch only when external context is needed (single quick URL reads). For research: use web_search, code_search, fetch_content (Harness+Agent), or get_search_content from pi-web-access."
      )
      parts.push(
        "On capability gaps: use questionnaire — state what's missing, list options (researcher subagent / web_fetch / gh skill install / user paste), wait for choice."
      )
      parts.push(
        "On resource install: use resource_install for Fleet Pi runtime resources. It writes to agent-workspace/pi; extensions/packages are staged unless the user explicitly asks to activate them. Start a new session or reload before relying on newly installed resources."
      )
    }

    const activePlan = await readActivePlan(cwd)
    if (activePlan) parts.push(`Active plan: ${activePlan}`)

    parts.push(
      formatProjectMemoryForStartupContext(await readProjectMemoryIndex(cwd))
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
    return keepLastCustomType(event.messages, CUSTOM_TYPE)
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

async function readWorkspaceAgents(cwd: string): Promise<string | undefined> {
  try {
    const content = await readFile(
      resolve(cwd, WORKSPACE_ROOT, "AGENTS.md"),
      "utf8"
    )
    return content.trim() || undefined
  } catch {
    return undefined
  }
}

function extractTitle(content: string): string | undefined {
  for (const line of content.split("\n")) {
    const match = line.match(/^#\s+(.+)/)
    if (match) return match[1].trim()
  }
  return undefined
}
