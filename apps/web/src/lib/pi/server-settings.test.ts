import { describe, expect, it } from "vitest"
import { mergeProjectSettings } from "./server-settings"

describe("project Pi settings merge", () => {
  it("preserves unknown fields and nested siblings", () => {
    const result = mergeProjectSettings(
      {
        customProviderConfig: { enabled: true },
        compaction: { enabled: true, reserveTokens: 100, custom: "keep" },
        retry: { enabled: true, provider: { timeoutMs: 5000 } },
        packages: ["npm:pi-autocontext"],
      },
      {
        compaction: { reserveTokens: 8192 },
        retry: { maxRetries: 4 },
      }
    )

    expect(result).toEqual({
      customProviderConfig: { enabled: true },
      compaction: {
        enabled: true,
        reserveTokens: 8192,
        custom: "keep",
      },
      retry: {
        enabled: true,
        maxRetries: 4,
        provider: { timeoutMs: 5000 },
      },
      packages: ["npm:pi-autocontext"],
    })
  })

  it("replaces project-scoped resource arrays without touching other keys", () => {
    const result = mergeProjectSettings(
      {
        packages: ["npm:old"],
        skills: ["../agent-workspace/pi/skills"],
        theme: "dark",
      },
      {
        packages: [
          "npm:pi-skills",
          { source: "npm:team-pack", extensions: [] },
        ],
        skills: ["../agent-workspace/pi/skills", "../custom-skills"],
      }
    )

    expect(result).toMatchObject({
      packages: ["npm:pi-skills", { source: "npm:team-pack", extensions: [] }],
      skills: ["../agent-workspace/pi/skills", "../custom-skills"],
      theme: "dark",
    })
  })

  it("clears optional model allowlists when requested", () => {
    const result = mergeProjectSettings(
      {
        enabledModels: ["github-copilot/*", "amazon-bedrock/*"],
        packages: ["npm:pi-autocontext"],
      },
      {
        enabledModels: null,
      }
    )

    expect(result).toEqual({
      packages: ["npm:pi-autocontext"],
    })
  })
})
