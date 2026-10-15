import { describe, expect, it } from "vitest"
import {
  durableLoopSettingsFromProject,
  harnessSettingsFromLoop,
} from "../durable-loop-settings"

describe("durable loop settings", () => {
  it("maps a saved reserve and retry max onto harness settings", () => {
    const loop = durableLoopSettingsFromProject({
      compaction: {
        enabled: true,
        reserveTokens: 111,
        keepRecentTokens: 80,
        backgroundTokens: 50,
      },
      retry: { maxRetries: 7, maxAgentDelayMs: 4000 },
      steeringMode: "all",
      followUpMode: "one-at-a-time",
      defaultThinkingLevel: "high",
    })

    expect(harnessSettingsFromLoop(loop)).toEqual({
      compaction: {
        enabled: true,
        reserveTokens: 111,
        keepRecentTokens: 80,
        backgroundTokens: 50,
      },
      retry: { maxRetries: 7, maxAgentDelayMs: 4000 },
      steeringMode: "all",
      followUpMode: "one-at-a-time",
    })
    expect(loop.thinkingLevel).toBe("high")
  })

  it("drops unknown queue and thinking values", () => {
    const loop = durableLoopSettingsFromProject({
      steeringMode: "steer",
      defaultThinkingLevel: "turbo",
    })
    expect(loop.steeringMode).toBeUndefined()
    expect(loop.thinkingLevel).toBeUndefined()
    expect(harnessSettingsFromLoop(loop)).toBeUndefined()
  })
})
