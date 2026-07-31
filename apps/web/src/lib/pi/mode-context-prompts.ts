import { buildOpenUIPrompt } from "@workspace/pi-protocol/openui-prompt"
import type { ChatMode } from "@workspace/pi-protocol/chat-protocol"
import type { PlanModeState } from "./plan-state"

const PROJECT_RESOURCE_TOOLS = [
  "project_inventory",
  "workspace_index",
  "workspace_improver",
]
const AUTOCONTEXT_STATUS_TOOLS = [
  "autocontext_status",
  "autocontext_scenarios",
  "autocontext_runtime_snapshot",
]
const AUTOCONTEXT_AGENT_TOOLS = [
  "autocontext_judge",
  "autocontext_improve",
  ...AUTOCONTEXT_STATUS_TOOLS,
  "autocontext_queue",
]
const AUTORESEARCH_AGENT_TOOLS = [
  "init_experiment",
  "run_experiment",
  "log_experiment",
]
const SUBAGENT_AGENT_TOOLS = ["subagent"]
const DAYTONA_SANDBOX_TOOLS = ["daytona_get_status", "preview_url"]
const WEB_ACCESS_READ_TOOLS = [
  "web_search",
  "code_search",
  "get_search_content",
]
const WEB_ACCESS_AGENT_TOOLS = [...WEB_ACCESS_READ_TOOLS, "fetch_content"]
export const PLAN_MODE_TOOLS = [
  "read",
  "bash",
  "grep",
  "find",
  "ls",
  "questionnaire",
  ...PROJECT_RESOURCE_TOOLS,
  ...AUTOCONTEXT_STATUS_TOOLS,
  ...WEB_ACCESS_READ_TOOLS,
]
export const HARNESS_MODE_TOOLS = [
  "read",
  "bash",
  "grep",
  "find",
  "ls",
  "workspace_write",
  "resource_install",
  "questionnaire",
  "web_fetch",
  ...PROJECT_RESOURCE_TOOLS,
  ...AUTOCONTEXT_STATUS_TOOLS,
  ...DAYTONA_SANDBOX_TOOLS,
  ...WEB_ACCESS_AGENT_TOOLS,
]
export const NORMAL_MODE_TOOLS = [
  "read",
  "bash",
  "edit",
  "write",
  "workspace_write",
  "resource_install",
  "questionnaire",
  "web_fetch",
  ...PROJECT_RESOURCE_TOOLS,
  ...AUTOCONTEXT_AGENT_TOOLS,
  ...AUTORESEARCH_AGENT_TOOLS,
  ...SUBAGENT_AGENT_TOOLS,
  ...DAYTONA_SANDBOX_TOOLS,
  ...WEB_ACCESS_AGENT_TOOLS,
]

export const AGENT_MODE_CONTEXT_CUSTOM_TYPE = "agent-mode-context"
export const PLAN_MODE_CONTEXT_CUSTOM_TYPE = "plan-mode-context"
export const PLAN_EXECUTION_CONTEXT_CUSTOM_TYPE = "plan-execution-context"
export const HARNESS_MODE_CONTEXT_CUSTOM_TYPE = "harness-mode-context"
export const MODE_CONTEXT_CUSTOM_TYPES = new Set([
  AGENT_MODE_CONTEXT_CUSTOM_TYPE,
  PLAN_MODE_CONTEXT_CUSTOM_TYPE,
  PLAN_EXECUTION_CONTEXT_CUSTOM_TYPE,
  HARNESS_MODE_CONTEXT_CUSTOM_TYPE,
])

export type ModeContextMessage = {
  customType: string
  content: string
}

export function buildModeContextMessage(
  state: PlanModeState,
  mode: ChatMode
): ModeContextMessage | undefined {
  if (state.enabled) {
    return {
      customType: PLAN_MODE_CONTEXT_CUSTOM_TYPE,
      content: `[PLAN MODE ACTIVE]
You are in plan mode: a read-only exploration mode for safe code analysis.

Restrictions:
- You can only use: ${PLAN_MODE_TOOLS.join(", ")}
- You CANNOT use edit or write tools.
- Bash is restricted to read-only local inspection commands. Network access, shell execution, command substitution, redirection, and file/process mutation are blocked.
- Ask clarifying questions with the questionnaire tool when intent, scope, or tradeoffs are unclear.
- Treat agent-workspace/ as Fleet Pi's own environment. Do not redesign or manage its architecture from Plan mode; switch to Harness mode for that.

Create a concise numbered plan under a "Plan:" header:

Plan:
1. First step description
2. Second step description

Do not make code changes in plan mode.`,
    }
  }

  if (state.executing && state.todos.length > 0) {
    const remaining = state.todos.filter((todo) => !todo.completed)
    const todoList = remaining
      .map((todo) => `${todo.step}. ${todo.text}`)
      .join("\n")

    const openUiPrompt = buildOpenUIPrompt("plan-execution")

    return {
      customType: PLAN_EXECUTION_CONTEXT_CUSTOM_TYPE,
      content: `[EXECUTING PLAN - Full tool access enabled]

Remaining steps:
${todoList}

Execute each step in order. After completing a step, include a [DONE:n] tag in your response.

${openUiPrompt}`,
    }
  }

  if (mode === "harness") {
    return {
      customType: HARNESS_MODE_CONTEXT_CUSTOM_TYPE,
      content: `[HARNESS MODE ACTIVE]
You are managing Fleet Pi's agent-workspace/ architecture and durable adaptive layer.

Pi architecture alignment:
- Keep Fleet Pi's core small and prefer Pi-native extension points.
- Model architecture changes around Pi's documented TypeScript extensions, skills, prompt templates, themes, packages, project settings, sessions, and SDK/runtime APIs.
- Prefer @earendil-works/pi-coding-agent as the primary facade. Use @earendil-works/pi-ai and @earendil-works/pi-agent-core concepts when deeper model, message, agent state, or runtime architecture work requires them.

Restrictions:
- You can only use: ${HARNESS_MODE_TOOLS.join(", ")}
- Read the repo for context, but do not mutate application code with edit or write.
- Use workspace_index and project_inventory for orientation.
- Use workspace_write for durable agent-workspace/ updates and include rationale for rationale-required/protected areas.
- Use resource_install for Pi skills, prompts, extensions, themes, and package bundles.
- Bash is restricted to read-only local inspection commands.
- Ask clarifying questions with the questionnaire tool when architecture ownership, Pi compatibility, or safety tradeoffs are unclear.`,
    }
  }

  const openUiPrompt = buildOpenUIPrompt(mode === "plan" ? "plan" : "agent")

  return {
    customType: AGENT_MODE_CONTEXT_CUSTOM_TYPE,
    content: `[AGENT MODE ACTIVE]
Follow the operating constraints from agent-workspace/AGENTS.md (injected in workspace context).
Use agent-workspace/ as context when it helps the coding task. Do not redesign or manage the agent-workspace/ architecture from Agent mode unless the user explicitly asks to switch to Harness mode.

${openUiPrompt}`,
  }
}
