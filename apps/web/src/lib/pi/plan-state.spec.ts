import { describe, expect, it } from "vitest"
import {
  applyPlanModeSelection,
  bindPendingPlanDecisionToolCallId,
  applyPlanModeSelection,
  createEmptyPlanState,
  createPlanEvent,
  createPlanToolPart,
  isPlanDecisionToolCall,
  resolvePlanDecision,
  restorePlanState,
  toChatPlanState,
  updatePlanExecutionProgress,
  updatePlanStateFromAssistantText,
} from "./plan-state"

describe("plan state", () => {
  it("enables plan mode without starting execution", () => {
    const state = applyPlanModeSelection(createEmptyPlanState(), "plan")

    expect(state.enabled).toBe(true)
    expect(state.executing).toBe(false)
  })

  it("extracts plan todos from assistant text", () => {
    const result = updatePlanStateFromAssistantText(
      applyPlanModeSelection(createEmptyPlanState(), "plan"),
      `Plan:\n1. Read the route\n2. Update the handler`
    )

    expect(result.changed).toBe(true)
    expect(result.state.pendingDecision).toBe(true)
    expect(result.state.todos.map((todo) => todo.text)).toEqual([
      "Route",
      "Handler",
    ])
  })

  it("marks execution progress and stops when all steps finish", () => {
    const executing = {
      enabled: false,
      executing: true,
      pendingDecision: false,
      todos: [
        { step: 1, text: "First step", completed: false },
        { step: 2, text: "Second step", completed: false },
      ],
    }

    const partial = updatePlanExecutionProgress(executing, "Done [DONE:1]")
    expect(partial.changed).toBe(true)
    expect(partial.state.executing).toBe(true)
    expect(partial.state.todos[0].completed).toBe(true)

    const complete = updatePlanExecutionProgress(partial.state, "Done [DONE:2]")
    expect(complete.changed).toBe(true)
    expect(complete.state.executing).toBe(false)
    expect(complete.state.todos.every((todo) => todo.completed)).toBe(true)
  })

  it("turns an execute decision into an agent handoff", () => {
    const decision = resolvePlanDecision(
      {
        enabled: true,
        executing: false,
        pendingDecision: true,
        todos: [{ step: 1, text: "Inspect code", completed: false }],
      },
      { kind: "single", selectedIds: ["execute"] }
    )

    expect(decision.state.enabled).toBe(false)
    expect(decision.state.executing).toBe(true)
    expect(decision.response).toMatchObject({
      ok: true,
      mode: "agent",
      planAction: "execute",
    })
  })

  it("emits a structured plan event snapshot", () => {
    const state = updatePlanStateFromAssistantText(
      applyPlanModeSelection(createEmptyPlanState(), "plan"),
      `Plan:\n1. Read the route\n2. Update the handler`
    ).state

    expect(createPlanEvent(state)).toMatchObject({
      type: "plan",
      mode: "plan",
      state: {
        pendingDecision: true,
        completed: 0,
        total: 2,
        todos: [
          { step: 1, text: "Route", completed: false },
          { step: 2, text: "Handler", completed: false },
        ],
      },
    })
  })

  it("builds a structured plan tool part", () => {
    const state = bindPendingPlanDecisionToolCallId(
      updatePlanStateFromAssistantText(
        applyPlanModeSelection(createEmptyPlanState(), "plan"),
        `Plan:\n1. Read the route\n2. Update the handler`
      ).state,
      "assistant-1"
    )

    expect(createPlanToolPart("assistant-1", state)).toMatchObject({
      type: "tool-PlanWrite",
      toolCallId: "plan-mode-decision-assistant-1",
      input: {
        pendingDecision: true,
        total: 2,
        plan: {
          id: "assistant-1",
          title: "Execution plan",
          status: "awaiting_approval",
        },
      },
    })
  })

  it("reuses the persisted pending decision tool call id", () => {
    const state = bindPendingPlanDecisionToolCallId(
      updatePlanStateFromAssistantText(
        applyPlanModeSelection(createEmptyPlanState(), "plan"),
        `Plan:\n1. Read the route`
      ).state,
      "chat-assistant-7"
    )

    expect(createPlanToolPart("hydrated-assistant-id", state)).toMatchObject({
      toolCallId: "plan-mode-decision-chat-assistant-7",
      input: {
        pendingDecision: true,
        plan: {
          id: "hydrated-assistant-id",
        },
      },
    })
  })

  it("restores persisted state defensively", () => {
    expect(restorePlanState(null)).toEqual(createEmptyPlanState())
    expect(
      restorePlanState({
        enabled: 1,
        executing: true,
        pendingDecision: true,
        pendingDecisionToolCallId: 123,
        todos: [
          { step: 3, text: "Keep me", completed: true },
          { text: "Infer step" },
          { step: Number.NaN, text: "" },
          null,
        ],
      })
    ).toEqual({
      enabled: true,
      executing: true,
      pendingDecision: true,
      pendingDecisionToolCallId: undefined,
      todos: [
        { step: 3, text: "Keep me", completed: true },
        { step: 2, text: "Infer step", completed: false },
      ],
    })
  })

  it("keeps state unchanged when there is no active plan work", () => {
    const disabled = createEmptyPlanState()

    expect(
      updatePlanStateFromAssistantText(disabled, "Plan:\n1. Test")
    ).toEqual({
      state: disabled,
      changed: false,
    })
    expect(
      updatePlanExecutionProgress(
        { ...disabled, todos: [{ step: 1, text: "Test", completed: false }] },
        "[DONE:1]"
      )
    ).toEqual({
      state: {
        ...disabled,
        todos: [{ step: 1, text: "Test", completed: false }],
      },
      changed: false,
    })
    expect(createPlanToolPart("assistant-empty", disabled)).toBeUndefined()
  })

  it("handles execute, refine, and stay-in-plan decisions", () => {
    const ready = {
      enabled: true,
      executing: false,
      pendingDecision: true,
      pendingDecisionToolCallId: "plan-mode-decision-assistant",
      todos: [{ step: 1, text: "Already done", completed: true }],
    }

    expect(applyPlanModeSelection(ready, "agent", "execute")).toMatchObject({
      enabled: false,
      executing: false,
      pendingDecision: false,
    })

    const refineWithText = resolvePlanDecision(ready, {
      kind: "text",
      text: "Make the test narrower",
    })
    expect(refineWithText.state).toMatchObject({
      enabled: true,
      executing: false,
      pendingDecision: false,
    })
    expect(refineWithText.response).toMatchObject({
      mode: "plan",
      planAction: "refine",
      message: "Make the test narrower",
    })

    const stay = resolvePlanDecision(ready, { kind: "skip" })
    expect(stay.response).toEqual({ ok: true })
    expect(stay.state.enabled).toBe(true)
  })

  it("formats approved, executing, and completed plan snapshots", () => {
    const executing = {
      enabled: false,
      executing: true,
      pendingDecision: false,
      todos: [
        { step: 1, text: "Done", completed: true },
        { step: 2, text: "Remaining", completed: false },
      ],
    }
    const completed = {
      ...executing,
      executing: false,
      todos: executing.todos.map((todo) => ({ ...todo, completed: true })),
    }

    expect(toChatPlanState(executing)).toMatchObject({
      mode: "agent",
      message: "Plan progress 1/2",
      completed: 1,
      total: 2,
    })
    expect(createPlanToolPart("assistant-running", executing)).toMatchObject({
      input: {
        executing: true,
        plan: {
          title: "Executing plan",
          status: "approved",
          summary: expect.stringContaining("Progress: 1/2 completed."),
        },
      },
    })
    expect(createPlanToolPart("assistant-complete", completed)).toMatchObject({
      input: {
        plan: {
          status: "completed",
          summary: expect.stringContaining("All plan steps are complete."),
        },
      },
    })
    expect(isPlanDecisionToolCall("plan-mode-decision-assistant")).toBe(true)
    expect(isPlanDecisionToolCall("tool-other")).toBe(false)
  })
})
