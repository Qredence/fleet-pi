import { describe, expect, it } from "vitest"
import {
  applyPlanModeSelection,
  createEmptyPlanState,
  createPlanEvent,
  createPlanToolPart,
  resolvePlanDecision,
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
    const state = updatePlanStateFromAssistantText(
      applyPlanModeSelection(createEmptyPlanState(), "plan"),
      `Plan:\n1. Read the route\n2. Update the handler`
    ).state

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
})
