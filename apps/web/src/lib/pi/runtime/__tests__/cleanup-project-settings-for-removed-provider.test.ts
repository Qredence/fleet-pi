import { describe, expect, it } from "vitest"
import { cleanupProjectSettingsForRemovedProvider } from "../cleanup-project-settings-for-removed-provider"

describe("cleanupProjectSettingsForRemovedProvider", () => {
  it("clears default provider and model when removing that provider", () => {
    expect(
      cleanupProjectSettingsForRemovedProvider(
        {
          defaultProvider: "google",
          defaultModel: "gemini-3.5-flash",
          packages: ["npm:pi-web-access"],
        },
        "google"
      )
    ).toEqual({
      packages: ["npm:pi-web-access"],
    })
  })

  it("removes enabled model patterns for the removed provider and keeps others", () => {
    expect(
      cleanupProjectSettingsForRemovedProvider(
        {
          enabledModels: ["google/*", "openai-chat-completions/my-model", "/*"],
        },
        "google"
      )
    ).toEqual({
      enabledModels: ["openai-chat-completions/my-model", "/*"],
    })
  })

  it("drops enabledModels when only the removed provider was allowlisted", () => {
    expect(
      cleanupProjectSettingsForRemovedProvider(
        {
          enabledModels: ["openai-chat-completions/my-model"],
        },
        "openai-chat-completions"
      )
    ).toEqual({})
  })
})
