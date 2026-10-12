import { describe, expect, it } from "vitest"
import {
  NoChatModelAvailableError,
  resolveDefaultChatModel,
  sessionHasRestorableModel,
} from "../default-chat-model"
import type { Model } from "@earendil-works/pi-ai"

function model(provider: string, id: string): Model<any> {
  return { provider, id, name: id } as unknown as Model<any>
}

function runtime(
  available: Array<Model<any>>,
  authed: Array<string> = available.map((entry) => entry.provider)
) {
  const auth = new Set(authed)
  return {
    getAvailable: () => Promise.resolve(available),
    getModel: (provider: string, id: string) =>
      available.find((entry) => entry.provider === provider && entry.id === id),
    hasConfiguredAuth: (provider: string) => auth.has(provider),
  }
}

const occ = model("openai-chat-completions", "command-model")
const openai = model("openai", "gpt-5.5")
const google = model("google", "gemini-3.5-flash")

describe("resolveDefaultChatModel", () => {
  it("uses the configured default when its provider has auth", async () => {
    await expect(
      resolveDefaultChatModel({
        modelRuntime: runtime([openai, occ]),
        configuredDefault: occ,
      })
    ).resolves.toBe(occ)
  })

  it("skips a configured default without auth and prefers app-added enabled models", async () => {
    const unauthed = model("anthropic", "claude-x")
    await expect(
      resolveDefaultChatModel({
        modelRuntime: runtime([openai, occ]),
        configuredDefault: unauthed,
        preferredKeys: new Set(["openai-chat-completions/command-model"]),
      })
    ).resolves.toBe(occ)
  })

  it("never falls back to openai/gpt-5.5 ahead of an enabled model", async () => {
    await expect(
      resolveDefaultChatModel({
        modelRuntime: runtime([openai, google]),
        isEnabled: (entry) => entry.provider === "google",
      })
    ).resolves.toBe(google)
  })

  it("uses the first enabled authenticated model when no preferred key matches", async () => {
    await expect(
      resolveDefaultChatModel({
        modelRuntime: runtime([google, openai]),
        preferredKeys: new Set(["custom+x/none"]),
      })
    ).resolves.toBe(google)
  })

  it("falls back to any authenticated model when none is enabled", async () => {
    await expect(
      resolveDefaultChatModel({
        modelRuntime: runtime([google]),
        isEnabled: () => false,
      })
    ).resolves.toBe(google)
  })

  it("ignores available models whose provider lacks configured auth", async () => {
    await expect(
      resolveDefaultChatModel({
        modelRuntime: runtime([openai, google], ["google"]),
      })
    ).resolves.toBe(google)
  })

  it("throws a clear error when no model has auth", async () => {
    const pending = resolveDefaultChatModel({
      modelRuntime: runtime([openai], []),
      configuredDefault: occ,
    })
    await expect(pending).rejects.toBeInstanceOf(NoChatModelAvailableError)
    await expect(pending).rejects.toThrow(/Settings > Providers/)
  })
})

describe("sessionHasRestorableModel", () => {
  const services = { modelRuntime: runtime([occ]) }

  it("is false for a new session", () => {
    expect(
      sessionHasRestorableModel(
        { buildSessionContext: () => ({ messages: [], model: null }) },
        services
      )
    ).toBe(false)
  })

  it("is true when the session model still has auth", () => {
    expect(
      sessionHasRestorableModel(
        {
          buildSessionContext: () => ({
            messages: [{}],
            model: { provider: occ.provider, modelId: occ.id },
          }),
        },
        services
      )
    ).toBe(true)
  })

  it("is false when the session model is gone or unauthenticated", () => {
    expect(
      sessionHasRestorableModel(
        {
          buildSessionContext: () => ({
            messages: [{}],
            model: { provider: "openai", modelId: "gpt-5.5" },
          }),
        },
        services
      )
    ).toBe(false)
  })
})
