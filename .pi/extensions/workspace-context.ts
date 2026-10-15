import { readFile, readdir } from "node:fs/promises"
import { resolve } from "node:path"
import { isInsideUserVolume } from "./lib/project-trust"
import {
  formatProjectMemoryForStartupContext,
  readProjectMemoryIndex,
} from "./lib/workspace-memory-index"
import { applyFleetPiIdentity } from "./lib/fleet-pi-identity"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

const WORKSPACE_ROOT = "agent-workspace"
const CUSTOM_TYPE = "workspace-context"

function buildWorkspaceBoot(cwd: string): string {
  const policyPrefix = isInsideUserVolume(cwd) ? "" : `${WORKSPACE_ROOT}/`
  return [
    "Identity: You are Fleet Pi, working in agent-workspace.",
    "Mutation tiers: free — scratch/**, artifacts/traces/**, artifacts/reports/**, memory/daily/**. Rationale required — memory/project/**, memory/research/**, memory/summaries/**, plans/**, skills/**, pi/skills/**, pi/prompts/** via workspace_write. Protected — system/** and evals/** via workspace_write with override:true.",
    `Read before changing the workspace: ${policyPrefix}system/workspace-policy.md, ${policyPrefix}system/constraints.md, and ${policyPrefix}memory/project/.`,
  ].join("\n")
}

export default function workspaceContextExtension(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, ctx) => {
    applyFleetPiIdentity(event)
    const cwd = ctx.sessionManager.getCwd()
    const parts: Array<string> = ["[WORKSPACE CONTEXT]"]
    omitProductRepoAgents(event, cwd)
    parts.push(buildWorkspaceBoot(cwd))

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

  pi.on("context", async (event, ctx) => {
    const messages = event.messages

    let lastUserPrompt = ""
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index]
      if (message.role === "user" && typeof message.content === "string") {
        lastUserPrompt = message.content
        break
      }
      if (message.role === "user" && Array.isArray(message.content)) {
        const textParts = message.content
          .filter((part) => part && typeof part === "object" && "text" in part)
          .map((part) => (part as { text: string }).text)
        if (textParts.length > 0) {
          lastUserPrompt = textParts.join("\n")
          break
        }
      }
    }

    let lastWorkspaceContextIndex = -1
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index] as { customType?: string }
      if (message.customType === CUSTOM_TYPE) {
        lastWorkspaceContextIndex = index
        break
      }
    }

    if (lastWorkspaceContextIndex === -1) return undefined

    const cwd = ctx.sessionManager.getCwd()
    const parts: Array<string> = [
      "[WORKSPACE CONTEXT]",
      buildWorkspaceBoot(cwd),
    ]

    const activePlan = await readActivePlan(cwd)
    if (activePlan) parts.push(`Active plan: ${activePlan}`)

    const memoryIndex = await readProjectMemoryIndex(cwd)
    parts.push(
      formatProjectMemoryForStartupContext(memoryIndex, lastUserPrompt)
    )

    const updatedMessages = [...messages]
    updatedMessages[lastWorkspaceContextIndex] = {
      ...updatedMessages[lastWorkspaceContextIndex],
      content: parts.join("\n"),
    } as (typeof messages)[number]

    const filteredMessages = updatedMessages.filter((message, index) => {
      if (index === lastWorkspaceContextIndex) return true
      const customMessage = message as { customType?: string }
      return customMessage.customType !== CUSTOM_TYPE
    })

    return { messages: filteredMessages }
  })
}

function omitProductRepoAgents(
  event: {
    systemPromptOptions?: {
      contextFiles?: Array<{ path: string; content: string }>
    }
  },
  cwd: string
) {
  const options = event.systemPromptOptions
  const contextFiles = options?.contextFiles
  if (!options || !contextFiles || !isInsideUserVolume(cwd)) return
  options.contextFiles = contextFiles.filter((file) => {
    const path = file.path.replace(/\\/g, "/")
    return path !== "AGENTS.md" && !path.endsWith("/AGENTS.md")
  })
}

async function readActivePlan(cwd: string): Promise<string | undefined> {
  try {
    const activeDir = resolve(cwd, WORKSPACE_ROOT, "plans/active")
    const entries = await readdir(activeDir, { withFileTypes: true })
    const plans = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b))
    if (plans.length === 0) return undefined

    const planFile = plans[0]
    if (!planFile) return undefined
    const content = await readFile(resolve(activeDir, planFile), "utf8")
    const title = extractTitle(content) ?? planFile.replace(/\.md$/, "")
    return `${title} (plans/active/${planFile})`
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
