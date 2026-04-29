import { describe, expect, it } from "vitest"
import {
  cleanStepText,
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
})
