import { describe, expect, it } from "vitest"
import { applySandboxCwdToPrompt } from "../../../../../../.pi/extensions/lib/sandbox-prompt-cwd"

describe("applySandboxCwdToPrompt", () => {
  it("sets the structured cwd option (Pi 1.x) without forcing the prompt", () => {
    const event = {
      systemPrompt: "<cwd>\n/srv/app\n</cwd>",
      systemPromptOptions: { cwd: "/srv/app" },
    }
    const result = applySandboxCwdToPrompt(
      event as never,
      "/home/daytona/workspace",
      "abc123"
    )
    expect(result).toBeUndefined()
    expect(event.systemPromptOptions.cwd).toBe(
      "/home/daytona/workspace (Daytona sandbox abc123)"
    )
  })

  it("falls back to rewriting a legacy cwd line", () => {
    expect(
      applySandboxCwdToPrompt(
        { systemPrompt: "x\nCurrent working directory: /srv/app\ny" },
        "/home/daytona/workspace",
        "abc123"
      )
    ).toEqual({
      systemPrompt:
        "x\nCurrent working directory: /home/daytona/workspace (Daytona sandbox abc123)\ny",
    })
  })

  it("leaves a prompt without a cwd line untouched", () => {
    expect(
      applySandboxCwdToPrompt({ systemPrompt: "no cwd" }, "/w", "id")
    ).toBeUndefined()
  })
})
