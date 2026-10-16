import { existsSync } from "node:fs"
import { resolve } from "node:path"
import bedrockBearerAuthExtension from "../../../../../../.pi/extensions/bedrock-bearer-auth"
import daytonaSandboxExtension from "../../../../../../.pi/extensions/daytona-sandbox"
import {
  FLEET_PI_PROMPT_SECTION,
  applyFleetPiIdentity,
} from "../../../../../../.pi/extensions/lib/fleet-pi-identity"
import trustHandlerExtension from "../../../../../../.pi/extensions/trust-handler"
import webFetchExtension from "../../../../../../.pi/extensions/web-fetch"
import type {
  BeforeAgentStartEvent,
  ExtensionAPI,
  InlineExtension,
} from "@earendil-works/pi-coding-agent"
import type { ChatWorkspaceStatus } from "@workspace/pi-protocol/chat-protocol"

/** System prompt section added when the runtime has no workspace tools. */
const FLEET_PI_NO_TOOLS_PROMPT_SECTION = "fleet_pi_workspace"

export const FLEET_PI_NO_TOOLS_NOTICE = [
  "Workspace tools are unavailable in this session: no Daytona API key is configured, so you have no file, shell, search or workspace tools and cannot read or change the user's repository.",
  "Do not attempt file, shell or search tool calls. Answer from the conversation alone.",
  "If the user asks for work that needs files or commands, tell them to add a Daytona API key in Settings → Providers to enable Daytona workspaces.",
].join("\n")

/**
 * Tools that act on a filesystem or sandbox. Removed from the active tool set
 * when `toolsAvailable` is false so the model cannot call tools that would fail.
 */
export const WORKSPACE_TOOL_NAMES: ReadonlySet<string> = new Set([
  "read",
  "bash",
  "edit",
  "write",
  "grep",
  "find",
  "ls",
  "workspace_write",
  "workspace_index",
  "workspace_improver",
  "project_inventory",
  "resource_install",
  "daytona_get_status",
  "preview_url",
])

/** Active tool names minus workspace tools (used when toolsAvailable is false). */
export function withoutWorkspaceTools(toolNames: ReadonlyArray<string>) {
  return toolNames.filter((name) => !WORKSPACE_TOOL_NAMES.has(name))
}

/**
 * Hosted deploys (Cloudflare / Cloudflare Workers) have no usable local project
 * filesystem: workspace tools only work through a Daytona sandbox.
 */
export function resolveChatWorkspaceStatus(input: {
  daytonaEnabled: boolean
  hostedDeployment: boolean
}): ChatWorkspaceStatus {
  if (input.daytonaEnabled || !input.hostedDeployment) {
    return { toolsAvailable: true }
  }
  return { toolsAvailable: false, reason: "daytona_credential_required" }
}

/** Applies the Fleet Pi identity (and no-tools notice) to prompt options. */
export function applyFleetPiCorePrompt(
  event: Pick<BeforeAgentStartEvent, "systemPromptOptions"> | undefined,
  workspace: ChatWorkspaceStatus
) {
  applyFleetPiIdentity(event)
  const options = event?.systemPromptOptions
  if (!options) return
  if (!workspace.toolsAvailable) {
    options.sections = {
      ...options.sections,
      [FLEET_PI_NO_TOOLS_PROMPT_SECTION]: FLEET_PI_NO_TOOLS_NOTICE,
    }
  }
}

/**
 * Server-owned inline extension: always loaded (no filesystem discovery), so
 * the identity is present even when `.pi/extensions` cannot be discovered, as
 * on the Worker bundle. The section is keyed by name, so the file-based
 * workspace-context extension setting the same key never duplicates it.
 */
export function createFleetPiCoreExtension(
  workspace: ChatWorkspaceStatus
): InlineExtension {
  return {
    name: "fleet-pi-core",
    hidden: true,
    factory: (pi: ExtensionAPI) => {
      pi.on("before_agent_start", (event) => {
        applyFleetPiCorePrompt(event, workspace)
      })
    },
  }
}

/**
 * Extensions that need no agent-workspace filesystem. Bundled statically and
 * loaded inline when the project has no discoverable `.pi/extensions` dir
 * (Worker bundle), so a missing/unwritable workspace no longer drops them.
 */
export const WORKSPACE_FREE_EXTENSIONS: ReadonlyArray<{
  name: string
  factory: (pi: ExtensionAPI) => void | Promise<void>
}> = [
  { name: "bedrock-bearer-auth", factory: bedrockBearerAuthExtension },
  { name: "daytona-sandbox", factory: daytonaSandboxExtension },
  { name: "trust-handler", factory: trustHandlerExtension },
  { name: "web-fetch", factory: webFetchExtension },
]

export function hasDiscoverableProjectExtensions(projectRoot: string) {
  try {
    return existsSync(resolve(projectRoot, ".pi/extensions"))
  } catch {
    return false
  }
}

export function buildFleetPiInlineExtensions(input: {
  projectRoot: string
  workspace: ChatWorkspaceStatus
  hasProjectExtensions?: boolean
}): Array<InlineExtension> {
  const hasProjectExtensions =
    input.hasProjectExtensions ??
    hasDiscoverableProjectExtensions(input.projectRoot)
  return [
    createFleetPiCoreExtension(input.workspace),
    ...(hasProjectExtensions
      ? []
      : WORKSPACE_FREE_EXTENSIONS.map((extension) => ({
          name: extension.name,
          factory: extension.factory,
        }))),
  ]
}

export { FLEET_PI_PROMPT_SECTION }
