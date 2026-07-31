import { describe, expect, it } from "vitest"
import { buildOpenUIPrompt } from "@workspace/pi-protocol/openui-prompt"
import {
  AGENT_MODE_CONTEXT_CUSTOM_TYPE,
  HARNESS_MODE_CONTEXT_CUSTOM_TYPE,
  MODE_CONTEXT_CUSTOM_TYPES,
  PLAN_EXECUTION_CONTEXT_CUSTOM_TYPE,
  PLAN_MODE_CONTEXT_CUSTOM_TYPE,
  buildModeContextMessage,
} from "./mode-context-prompts"
import { createEmptyPlanState } from "./plan-state"
import type { PlanModeState } from "./plan-state"

const PLAN_MODE_TOOL_LIST =
  "read, bash, grep, find, ls, questionnaire, project_inventory, workspace_index, workspace_improver, autocontext_status, autocontext_scenarios, autocontext_runtime_snapshot, web_search, code_search, get_search_content"
const HARNESS_MODE_TOOL_LIST =
  "read, bash, grep, find, ls, workspace_write, resource_install, questionnaire, web_fetch, project_inventory, workspace_index, workspace_improver, autocontext_status, autocontext_scenarios, autocontext_runtime_snapshot, daytona_get_status, preview_url, web_search, code_search, get_search_content, fetch_content"

const PLAN_MODE_PROMPT = `[PLAN MODE ACTIVE]
You are in plan mode: a read-only exploration mode for safe code analysis.

Restrictions:
- You can only use: ${PLAN_MODE_TOOL_LIST}
- You CANNOT use edit or write tools.
- Bash is restricted to read-only local inspection commands. Network access, shell execution, command substitution, redirection, and file/process mutation are blocked.
- Ask clarifying questions with the questionnaire tool when intent, scope, or tradeoffs are unclear.
- Treat agent-workspace/ as Fleet Pi's own environment. Do not redesign or manage its architecture from Plan mode; switch to Harness mode for that.

Create a concise numbered plan under a "Plan:" header:

Plan:
1. First step description
2. Second step description

Do not make code changes in plan mode.`

const HARNESS_MODE_PROMPT = `[HARNESS MODE ACTIVE]
You are managing Fleet Pi's agent-workspace/ architecture and durable adaptive layer.

Pi architecture alignment:
- Keep Fleet Pi's core small and prefer Pi-native extension points.
- Model architecture changes around Pi's documented TypeScript extensions, skills, prompt templates, themes, packages, project settings, sessions, and SDK/runtime APIs.
- Prefer @earendil-works/pi-coding-agent as the primary facade. Use @earendil-works/pi-ai and @earendil-works/pi-agent-core concepts when deeper model, message, agent state, or runtime architecture work requires them.

Restrictions:
- You can only use: ${HARNESS_MODE_TOOL_LIST}
- Read the repo for context, but do not mutate application code with edit or write.
- Use workspace_index and project_inventory for orientation.
- Use workspace_write for durable agent-workspace/ updates and include rationale for rationale-required/protected areas.
- Use resource_install for Pi skills, prompts, extensions, themes, and package bundles.
- Bash is restricted to read-only local inspection commands.
- Ask clarifying questions with the questionnaire tool when architecture ownership, Pi compatibility, or safety tradeoffs are unclear.`

function stateWith(overrides: Partial<PlanModeState>): PlanModeState {
  return { ...createEmptyPlanState(), ...overrides }
}

describe("mode context custom types", () => {
  it("exposes stable customType values", () => {
    expect(AGENT_MODE_CONTEXT_CUSTOM_TYPE).toBe("agent-mode-context")
    expect(PLAN_MODE_CONTEXT_CUSTOM_TYPE).toBe("plan-mode-context")
    expect(PLAN_EXECUTION_CONTEXT_CUSTOM_TYPE).toBe("plan-execution-context")
    expect(HARNESS_MODE_CONTEXT_CUSTOM_TYPE).toBe("harness-mode-context")
  })

  it("registers every mode context customType in the filter set", () => {
    expect(new Set(MODE_CONTEXT_CUSTOM_TYPES)).toEqual(
      new Set([
        AGENT_MODE_CONTEXT_CUSTOM_TYPE,
        PLAN_MODE_CONTEXT_CUSTOM_TYPE,
        PLAN_EXECUTION_CONTEXT_CUSTOM_TYPE,
        HARNESS_MODE_CONTEXT_CUSTOM_TYPE,
      ])
    )
    expect(MODE_CONTEXT_CUSTOM_TYPES.size).toBe(4)
  })
})

describe("buildModeContextMessage", () => {
  describe("plan arm (state.enabled)", () => {
    it("returns the plan-mode prompt byte-identical to the previous inline template", () => {
      const message = buildModeContextMessage(
        stateWith({ enabled: true }),
        "agent"
      )

      expect(message).toEqual({
        customType: PLAN_MODE_CONTEXT_CUSTOM_TYPE,
        content: PLAN_MODE_PROMPT,
      })
    })

    it("returns the same plan-mode prompt when the chat mode is plan", () => {
      const message = buildModeContextMessage(
        stateWith({ enabled: true }),
        "plan"
      )

      expect(message).toEqual({
        customType: PLAN_MODE_CONTEXT_CUSTOM_TYPE,
        content: PLAN_MODE_PROMPT,
      })
    })

    it("wins over harness mode when plan is enabled", () => {
      const message = buildModeContextMessage(
        stateWith({ enabled: true }),
        "harness"
      )

      expect(message?.customType).toBe(PLAN_MODE_CONTEXT_CUSTOM_TYPE)
    })
  })

  describe("plan-executing arm (state.executing with todos)", () => {
    it("lists only remaining steps with the [DONE:n] instruction and the plan-execution OpenUI prompt", () => {
      const message = buildModeContextMessage(
        stateWith({
          executing: true,
          todos: [
            { step: 1, text: "Read the route", completed: true },
            { step: 2, text: "Patch the handler", completed: false },
            { step: 3, text: "Run the tests", completed: false },
          ],
        }),
        "agent"
      )

      expect(message).toEqual({
        customType: PLAN_EXECUTION_CONTEXT_CUSTOM_TYPE,
        content: `[EXECUTING PLAN - Full tool access enabled]

Remaining steps:
2. Patch the handler
3. Run the tests

Execute each step in order. After completing a step, include a [DONE:n] tag in your response.

${buildOpenUIPrompt("plan-execution")}`,
      })
    })

    it("wins over harness mode while executing a plan", () => {
      const message = buildModeContextMessage(
        stateWith({
          executing: true,
          todos: [{ step: 1, text: "Read the route", completed: false }],
        }),
        "harness"
      )

      expect(message?.customType).toBe(PLAN_EXECUTION_CONTEXT_CUSTOM_TYPE)
    })

    it("falls through to the agent arm when executing with empty todos", () => {
      const message = buildModeContextMessage(
        stateWith({ executing: true, todos: [] }),
        "agent"
      )

      expect(message?.customType).toBe(AGENT_MODE_CONTEXT_CUSTOM_TYPE)
      expect(message?.content).toBe(
        `[AGENT MODE ACTIVE]
Follow the operating constraints from agent-workspace/AGENTS.md (injected in workspace context).
Use agent-workspace/ as context when it helps the coding task. Do not redesign or manage the agent-workspace/ architecture from Agent mode unless the user explicitly asks to switch to Harness mode.

${buildOpenUIPrompt("agent")}`
      )
    })

    it("falls through to the harness arm when executing with empty todos in harness mode", () => {
      const message = buildModeContextMessage(
        stateWith({ executing: true, todos: [] }),
        "harness"
      )

      expect(message).toEqual({
        customType: HARNESS_MODE_CONTEXT_CUSTOM_TYPE,
        content: HARNESS_MODE_PROMPT,
      })
    })
  })

  describe("harness arm (mode harness)", () => {
    it("returns the harness prompt byte-identical to the previous inline template", () => {
      const message = buildModeContextMessage(createEmptyPlanState(), "harness")

      expect(message).toEqual({
        customType: HARNESS_MODE_CONTEXT_CUSTOM_TYPE,
        content: HARNESS_MODE_PROMPT,
      })
    })
  })

  describe("agent arm (default)", () => {
    it("returns the agent prompt with the agent OpenUI prompt in agent mode", () => {
      const message = buildModeContextMessage(createEmptyPlanState(), "agent")

      expect(message).toEqual({
        customType: AGENT_MODE_CONTEXT_CUSTOM_TYPE,
        content: `[AGENT MODE ACTIVE]
Follow the operating constraints from agent-workspace/AGENTS.md (injected in workspace context).
Use agent-workspace/ as context when it helps the coding task. Do not redesign or manage the agent-workspace/ architecture from Agent mode unless the user explicitly asks to switch to Harness mode.

${buildOpenUIPrompt("agent")}`,
      })
    })

    it("uses the plan OpenUI prompt when the chat mode is plan but plan state is inactive", () => {
      const message = buildModeContextMessage(createEmptyPlanState(), "plan")

      expect(message).toEqual({
        customType: AGENT_MODE_CONTEXT_CUSTOM_TYPE,
        content: `[AGENT MODE ACTIVE]
Follow the operating constraints from agent-workspace/AGENTS.md (injected in workspace context).
Use agent-workspace/ as context when it helps the coding task. Do not redesign or manage the agent-workspace/ architecture from Agent mode unless the user explicitly asks to switch to Harness mode.

${buildOpenUIPrompt("plan")}`,
      })
    })
  })
})
