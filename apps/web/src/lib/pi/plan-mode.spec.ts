import { describe, expect, it } from "vitest"
import {
  applyPlanMode,
  cleanStepText,
  createPlanModeExtension,
  extractDoneSteps,
  extractTodoItems,
  isSafeCommand,
  markCompletedSteps,
} from "./plan-mode"

describe("plan-mode utilities (vitest)", () => {
  describe("isSafeCommand", () => {
    it("allows read-only commands", () => {
      expect(isSafeCommand("rg plan-mode apps/web")).toBe(true)
      expect(isSafeCommand("sed -n '1,20p' apps/web/package.json")).toBe(true)
      expect(isSafeCommand("git diff -- apps/web/src/routes/index.tsx")).toBe(
        true
      )
      expect(isSafeCommand("pnpm list --filter web")).toBe(true)
    })

    it("blocks unsafe commands", () => {
      expect(isSafeCommand("rm -rf apps/web")).toBe(false)
      expect(isSafeCommand("echo hi > file.txt")).toBe(false)
      expect(isSafeCommand("git commit -m test")).toBe(false)
      expect(isSafeCommand("pnpm install")).toBe(false)
      expect(isSafeCommand("sudo whoami")).toBe(false)
    })
  })

  describe("extractTodoItems", () => {
    it("extracts numbered plan steps", () => {
      const todos = extractTodoItems(`Plan:
1. Read the current chat route
2. Add the mode selector
3. Verify typecheck`)

      expect(todos.map((todo) => todo.text)).toEqual([
        "Current chat route",
        "Mode selector",
        "Typecheck",
      ])
    })

    it("returns empty array when no plan header", () => {
      expect(extractTodoItems("Just some text")).toEqual([])
    })
  })

  describe("markCompletedSteps", () => {
    it("marks done steps", () => {
      const todos = extractTodoItems(`Plan:
1. Read files
2. Patch code`)

      expect(markCompletedSteps("Finished [DONE:1]", todos)).toBe(1)
      expect(todos[0].completed).toBe(true)
      expect(todos[1].completed).toBe(false)
    })
  })

  describe("cleanStepText", () => {
    it("removes markdown formatting", () => {
      expect(cleanStepText("**bold** text")).toBe("Bold text")
      expect(cleanStepText("`code` snippet")).toBe("Code snippet")
    })

    it("removes action verbs", () => {
      expect(cleanStepText("Read the file")).toBe("File")
      expect(cleanStepText("Update the config")).toBe("Config")
    })

    it("truncates long text", () => {
      const long = "a".repeat(60)
      expect(cleanStepText(long)).toBe("A" + "a".repeat(46) + "...")
    })
  })

  describe("extractDoneSteps", () => {
    it("extracts done step numbers", () => {
      expect(extractDoneSteps("[DONE:1] and [DONE:3]")).toEqual([1, 3])
    })

    it("returns empty array when no done tags", () => {
      expect(extractDoneSteps("no done tags here")).toEqual([])
    })
  })

  describe("createPlanModeExtension context filtering", () => {
    it("keeps existing context messages when active mode context has not been injected yet", () => {
      const sessionId = "session-context-missing-active"
      const contextHandler = createContextHandler()
      applyPlanMode(createMockRuntime(sessionId), "harness")
      const messages = [
        { role: "system", customType: "agent-mode-context" },
        { role: "system", customType: "plan-mode-context" },
        { role: "user", content: "hello" },
      ]

      const result = contextHandler(
        { messages },
        {
          sessionManager: {
            getSessionId: () => sessionId,
          },
        }
      )

      expect(result).toBeUndefined()
    })

    it("keeps only the latest active mode context when present", () => {
      const sessionId = "session-context-latest-active"
      const contextHandler = createContextHandler()
      applyPlanMode(createMockRuntime(sessionId), "harness")
      const messages = [
        { role: "system", customType: "harness-mode-context", content: "old" },
        { role: "system", customType: "agent-mode-context", content: "agent" },
        { role: "system", customType: "harness-mode-context", content: "new" },
        { role: "user", content: "hello" },
      ]

      const result = contextHandler(
        { messages },
        {
          sessionManager: {
            getSessionId: () => sessionId,
          },
        }
      )

      expect(result).toEqual({
        messages: [
          {
            role: "system",
            customType: "harness-mode-context",
            content: "new",
          },
          { role: "user", content: "hello" },
        ],
      })
    })
  })
})

function createContextHandler() {
  const handlers = new Map<string, (...args: Array<unknown>) => unknown>()
  createPlanModeExtension()({
    on(event: string, handler: unknown) {
      handlers.set(event, handler as (...args: Array<unknown>) => unknown)
    },
    appendEntry() {},
    registerTool() {},
  } as unknown as Parameters<ReturnType<typeof createPlanModeExtension>>[0])

  return handlers.get("context") as (
    event: { messages: Array<Record<string, unknown>> },
    ctx: { sessionManager: { getSessionId: () => string } }
  ) => unknown
}

function createMockRuntime(sessionId: string) {
  const entries: Array<Record<string, unknown>> = []
  return {
    session: {
      sessionId,
      setActiveToolsByName() {},
      sessionManager: {
        appendCustomEntry(customType: string, data: unknown) {
          entries.push({
            type: "custom",
            customType,
            data,
          })
        },
        getEntries() {
          return entries
        },
      },
    },
  } as unknown as Parameters<typeof applyPlanMode>[0]
}
