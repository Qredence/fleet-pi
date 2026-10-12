import { describe, expect, it, vi } from "vitest"

vi.mock("./use-chat-storage", () => ({ useChatStorage: vi.fn() }))

const { resolvePreferredModelKey } = await import("./use-chat-shell-state")

const models = [
  { id: "openai-chat-completions/qwen35-122b-a10b", available: true },
  { id: "openai-chat-completions/gpt-oss-120b", available: true },
]

describe("resolvePreferredModelKey", () => {
  it("falls back to the first model when the server reports an empty selection", () => {
    // Regression: `"" ?? models[0].id` kept "" and Enter never sent.
    expect(resolvePreferredModelKey(models, "")).toBe(models[0].id)
    expect(resolvePreferredModelKey(models, undefined)).toBe(models[0].id)
    expect(resolvePreferredModelKey(models, null)).toBe(models[0].id)
  })

  it("keeps a saved selection that is listed and available", () => {
    expect(resolvePreferredModelKey(models, models[1].id)).toBe(models[1].id)
  })

  it("ignores a saved key that is no longer listed or is unavailable", () => {
    expect(resolvePreferredModelKey(models, "gone/model")).toBe(models[0].id)
    expect(
      resolvePreferredModelKey(
        [{ id: "a", available: false }, { id: "b" }],
        "a"
      )
    ).toBe("b")
  })
})
