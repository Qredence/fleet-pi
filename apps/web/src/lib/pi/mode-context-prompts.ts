import { buildOpenUIPrompt } from "@workspace/pi-protocol/openui-prompt"
import type { ChatMode } from "@workspace/pi-protocol/chat-protocol"
import type { PlanModeState } from "./plan-state"

type LocalToolMode = "agent" | "plan" | "harness"

/** One catalog entry per local tool. Mode lists are filters, not copied arrays. */
const MODE_TOOL_CATALOG: Array<{
  name: string
  modes: ReadonlyArray<LocalToolMode>
}> = [
  { name: "read", modes: ["agent", "plan", "harness"] },
  { name: "bash", modes: ["agent", "plan", "harness"] },
  { name: "edit", modes: ["agent"] },
  { name: "write", modes: ["agent"] },
  { name: "grep", modes: ["plan", "harness"] },
  { name: "find", modes: ["plan", "harness"] },
  { name: "ls", modes: ["plan", "harness"] },
  { name: "workspace_write", modes: ["agent", "harness"] },
  { name: "resource_install", modes: ["agent", "harness"] },
  { name: "questionnaire", modes: ["agent", "plan", "harness"] },
  { name: "web_fetch", modes: ["agent", "harness"] },
  { name: "project_inventory", modes: ["agent", "plan", "harness"] },
  { name: "workspace_index", modes: ["agent", "plan", "harness"] },
  { name: "workspace_improver", modes: ["agent", "plan", "harness"] },
  { name: "autocontext_judge", modes: ["agent"] },
  { name: "autocontext_improve", modes: ["agent"] },
  { name: "autocontext_status", modes: ["agent", "plan", "harness"] },
  { name: "autocontext_scenarios", modes: ["agent", "plan", "harness"] },
  { name: "autocontext_runtime_snapshot", modes: ["agent", "plan", "harness"] },
  { name: "autocontext_queue", modes: ["agent"] },
  { name: "init_experiment", modes: ["agent"] },
  { name: "run_experiment", modes: ["agent"] },
  { name: "log_experiment", modes: ["agent"] },
  { name: "subagent", modes: ["agent"] },
  { name: "daytona_get_status", modes: ["agent", "harness"] },
  { name: "preview_url", modes: ["agent", "harness"] },
  { name: "web_search", modes: ["agent", "plan", "harness"] },
  { name: "code_search", modes: ["agent", "plan", "harness"] },
  { name: "get_search_content", modes: ["agent", "plan", "harness"] },
  { name: "fetch_content", modes: ["agent", "harness"] },
]

function toolNamesForMode(mode: LocalToolMode): Array<string> {
  return MODE_TOOL_CATALOG.filter((tool) => tool.modes.includes(mode)).map(
    (tool) => tool.name
  )
}

export const PLAN_MODE_TOOLS = toolNamesForMode("plan")
export const HARNESS_MODE_TOOLS = toolNamesForMode("harness")
export const NORMAL_MODE_TOOLS = toolNamesForMode("agent")

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
Follow the workspace boot section. Read system/constraints.md before changing the workspace.
Use agent-workspace/ as context when it helps the coding task. Do not redesign or manage the agent-workspace/ architecture from Agent mode unless the user explicitly asks to switch to Harness mode.

${openUiPrompt}`,
  }
}
