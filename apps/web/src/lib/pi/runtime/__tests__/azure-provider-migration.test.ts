import { describe, expect, it } from "vitest"
import {
  migrateLegacyAzureModelKey,
  migrateLegacyAzureProviderOverrides,
} from "../azure-provider-migration"

describe("migrateLegacyAzureProviderOverrides (Pi 1.0.3 azure rename)", () => {
  const legacy = {
    defaultProvider: "azure-openai-responses",
    defaultModel: "gpt-5",
    enabledModels: [
      "azure-openai-responses/gpt-5",
      "!azure-openai-responses/gpt-4o",
      "anthropic/*",
    ],
    modelThinkingLevels: {
      "azure-openai-responses/gpt-5": "high",
      "anthropic/claude": "low",
    },
    theme: "dark",
  }

  it("renames the provider in defaultProvider, enabledModels and modelThinkingLevels", () => {
    expect(migrateLegacyAzureProviderOverrides(legacy)).toEqual({
      defaultProvider: "azure",
      defaultModel: "gpt-5",
      enabledModels: ["azure/gpt-5", "!azure/gpt-4o", "anthropic/*"],
      modelThinkingLevels: { "azure/gpt-5": "high", "anthropic/claude": "low" },
      theme: "dark",
    })
  })

  it("does not mutate its input", () => {
    const input = structuredClone(legacy)
    migrateLegacyAzureProviderOverrides(input)
    expect(input).toEqual(legacy)
  })

  it("is idempotent", () => {
    const once = migrateLegacyAzureProviderOverrides(legacy)
    const twice = migrateLegacyAzureProviderOverrides(once)
    expect(twice).toEqual(once)
    // Already-migrated settings come back as the same object, so persistence
    // can skip a no-op write.
    expect(twice).toBe(once)
  })

  it("returns settings without the legacy id unchanged", () => {
    const current = { defaultProvider: "openai", enabledModels: ["openai/*"] }
    expect(migrateLegacyAzureProviderOverrides(current)).toBe(current)
  })

  it("keeps an explicit new-id thinking level over a migrated legacy one", () => {
    expect(
      migrateLegacyAzureProviderOverrides({
        modelThinkingLevels: {
          "azure-openai-responses/gpt-5": "high",
          "azure/gpt-5": "low",
        },
      })
    ).toEqual({ modelThinkingLevels: { "azure/gpt-5": "low" } })
  })

  it("only rewrites the exact provider id prefix", () => {
    expect(migrateLegacyAzureModelKey("azure-openai-responses-x/m")).toBe(
      "azure-openai-responses-x/m"
    )
    expect(migrateLegacyAzureModelKey("azure-openai-responses")).toBe("azure")
  })
})
