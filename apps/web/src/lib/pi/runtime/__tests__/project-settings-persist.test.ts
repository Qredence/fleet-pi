import { describe, expect, it } from "vitest"
import { FLEET_PI_BASE_PROJECT_SETTINGS } from "../fleet-default-project-settings"
import {
  prepareProjectSettingsForPersist,
  projectSettingsOverridesEqual,
} from "../project-settings-persist"

describe("project-settings-persist", () => {
  it("compacts overrides against Fleet base defaults", () => {
    expect(
      prepareProjectSettingsForPersist({
        defaultModel: "gemini-3.1-pro-preview",
      })
    ).toEqual({
      defaultModel: "gemini-3.1-pro-preview",
    })
  })

  it("omits workspace paths that match base defaults", () => {
    expect(
      prepareProjectSettingsForPersist({
        skills: FLEET_PI_BASE_PROJECT_SETTINGS.skills,
      })
    ).toEqual({})
  })

  it("compares override records for equality", () => {
    expect(projectSettingsOverridesEqual({ a: 1 }, { a: 1 })).toBe(true)
    expect(projectSettingsOverridesEqual({ a: 1 }, { a: 2 })).toBe(false)
  })
})
