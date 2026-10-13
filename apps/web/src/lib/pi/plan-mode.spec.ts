import { describe, expect, it } from "vitest"
import { evaluateWorkspaceWrite } from "../../../../../.pi/extensions/lib/mutation-tier"
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

  describe("agent workspace mutation tiers", () => {
    it("blocks raw writes that resolve into system/", () => {
      const direct = callTool("session-tier-system", {
        toolName: "write",
        input: {
          path: "system/identity.md",
          content: "changed",
        },
      })
      const dotted = callTool("session-tier-system-dotdot", {
        toolName: "write",
        input: {
          path: "agent-workspace/notes/../system/identity.md",
          content: "changed",
        },
      })

      expect(direct).toMatchObject({ block: true })
      expect(direct?.reason).toContain("protected")
      expect(dotted).toMatchObject({ block: true })
      expect(dotted?.reason).toContain("protected")
    })

    it("requires a rationale for instructions/", () => {
      const result = callTool("session-tier-instructions", {
        toolName: "write",
        input: {
          path: "instructions/README.md",
          content: "notes",
        },
      })

      expect(result).toMatchObject({ block: true })
      expect(result?.reason).toContain("rationale")
    })

    it("blocks memory/project/decisions.md without a rationale", () => {
      const raw = callTool("session-tier-memory", {
        toolName: "edit",
        input: {
          path: "agent-workspace/memory/project/decisions.md",
          edits: [],
        },
      })
      const workspaceWrite = evaluateWorkspaceWrite({
        displayPath: "agent-workspace/memory/project/decisions.md",
        relativePath: "memory/project/decisions.md",
      })

      expect(raw).toMatchObject({ block: true })
      expect(raw?.reason).toContain("rationale")
      expect(workspaceWrite).toMatchObject({ ok: false })
    })

    it("allows scratch writes and scratch bash", () => {
      expect(
        callTool("session-tier-scratch", {
          toolName: "write",
          input: { path: "scratch/note.md", content: "temp" },
        })
      ).toBeUndefined()
      expect(
        callTool("session-tier-scratch-bash", {
          toolName: "bash",
          input: { command: "rm scratch/note.md" },
        })
      ).toBeUndefined()
    })

    it("blocks mutating bash aimed at system/ and evals/", () => {
      const result = callTool("session-tier-bash", {
        toolName: "bash",
        input: { command: "rm -rf agent-workspace/system/identity.md" },
      })

      expect(result).toMatchObject({ block: true })
      expect(result?.reason).toContain("protected")
      expect(
        callTool("session-tier-evals", {
          toolName: "bash",
          input: { command: "cp notes.md evals/memory-quality.md" },
        })?.reason
      ).toContain("protected")
      expect(
        callTool("session-tier-sed", {
          toolName: "bash",
          input: { command: "sed -i 's/a/b/' system/identity.md" },
        })?.reason
      ).toContain("protected")
      expect(
        callTool("session-tier-find", {
          toolName: "bash",
          input: {
            command: "find agent-workspace/system -name '*.md' -delete",
          },
        })?.reason
      ).toContain("protected")
    })

    it("still allows ordinary repo writes", () => {
      expect(
        callTool("session-tier-repo", {
          toolName: "write",
          input: {
            path: "apps/web/src/routes/index.tsx",
            content: "export {}",
          },
        })
      ).toBeUndefined()
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

function callTool(
  sessionId: string,
  event: { toolName: string; input: Record<string, unknown> }
) {
  const handler = createToolCallHandler()
  return handler(
    { type: "tool_call", toolCallId: "call-1", ...event },
    { sessionManager: { getSessionId: () => sessionId } }
  ) as { block?: boolean; reason?: string } | undefined
}

function createToolCallHandler() {
  const handlers = new Map<string, (...args: Array<unknown>) => unknown>()
  createPlanModeExtension()({
    on(event: string, handler: unknown) {
      handlers.set(event, handler as (...args: Array<unknown>) => unknown)
    },
    appendEntry() {},
    registerTool() {},
  } as unknown as Parameters<ReturnType<typeof createPlanModeExtension>>[0])

  const handler = handlers.get("tool_call")
  if (!handler) throw new Error("tool_call handler was not registered")
  return handler
}

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
