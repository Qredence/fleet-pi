import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  extractTodoItems,
  isSafeCommand,
  markCompletedSteps,
} from "./plan-mode"

describe("plan-mode utilities", () => {
  it("allows read-only commands", () => {
    assert.equal(isSafeCommand("rg plan-mode apps/web"), true)
    assert.equal(isSafeCommand("sed -n '1,20p' apps/web/package.json"), true)
    assert.equal(isSafeCommand("git diff -- apps/web/src/routes/index.tsx"), true)
    assert.equal(isSafeCommand("pnpm list --filter web"), true)
  })

  it("blocks unsafe commands", () => {
    assert.equal(isSafeCommand("rm -rf apps/web"), false)
    assert.equal(isSafeCommand("echo hi > file.txt"), false)
    assert.equal(isSafeCommand("git commit -m test"), false)
    assert.equal(isSafeCommand("pnpm install"), false)
    assert.equal(isSafeCommand("sudo whoami"), false)
  })

  it("extracts numbered plan steps", () => {
    const todos = extractTodoItems(`Plan:
1. Read the current chat route
2. Add the mode selector
3. Verify typecheck`)

    assert.deepEqual(
      todos.map((todo) => todo.text),
      [
        "Current chat route",
        "Mode selector",
        "Typecheck",
      ],
    )
  })

  it("marks done steps", () => {
    const todos = extractTodoItems(`Plan:
1. Read files
2. Patch code`)

    assert.equal(markCompletedSteps("Finished [DONE:1]", todos), 1)
    assert.equal(todos[0].completed, true)
    assert.equal(todos[1].completed, false)
  })
})
