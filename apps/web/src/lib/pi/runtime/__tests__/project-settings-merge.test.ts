import { describe, expect, it } from "vitest"
import { FLEET_PI_BASE_PROJECT_SETTINGS } from "../fleet-default-project-settings"
import {
  compactProjectSettingsForPersist,
  isAllowAllEnabledModels,
  mergeProjectSettingsRecords,
} from "../project-settings-merge"

describe("project-settings-merge", () => {
  it("treats missing or wildcard enabledModels as allow-all", () => {
    expect(isAllowAllEnabledModels(undefined)).toBe(true)
    expect(isAllowAllEnabledModels(["/*"])).toBe(true)
    expect(isAllowAllEnabledModels(["google/*", "/*"])).toBe(true)
    expect(isAllowAllEnabledModels(["google/*"])).toBe(false)
    expect(isAllowAllEnabledModels([])).toBe(false)
  })

  it("omits enabledModels when merged settings are allow-all", () => {
    expect(
      compactProjectSettingsForPersist({
        ...FLEET_PI_BASE_PROJECT_SETTINGS,
        enabledModels: ["google/*", "/*"],
      })
    ).toEqual({})
  })

  it("returns empty overrides when merged equals base", () => {
    expect(
      compactProjectSettingsForPersist({ ...FLEET_PI_BASE_PROJECT_SETTINGS })
    ).toEqual({})
  })

  it("omits workspace resource paths that match Fleet base defaults", () => {
    expect(
      compactProjectSettingsForPersist({
        ...FLEET_PI_BASE_PROJECT_SETTINGS,
        skills: ["../agent-workspace/pi/skills"],
        prompts: ["../agent-workspace/pi/prompts"],
        extensions: ["../agent-workspace/pi/extensions/enabled"],
      })
    ).toEqual({})
  })

  it("keeps workspace resource path overrides", () => {
    expect(
      compactProjectSettingsForPersist({
        ...FLEET_PI_BASE_PROJECT_SETTINGS,
        skills: ["../agent-workspace/pi/skills/custom-skill"],
      })
    ).toEqual({
      skills: ["../agent-workspace/pi/skills/custom-skill"],
    })
  })

  it("strips auto-discovered .pi resource paths from persisted overrides", () => {
    expect(
      compactProjectSettingsForPersist({
        ...FLEET_PI_BASE_PROJECT_SETTINGS,
        extensions: [
          "extensions/project-inventory",
          "../agent-workspace/pi/extensions/enabled/foo.ts",
        ],
        skills: ["skills", "../agent-workspace/pi/skills/helper"],
      })
    ).toEqual({
      extensions: ["../agent-workspace/pi/extensions/enabled/foo.ts"],
      skills: ["../agent-workspace/pi/skills/helper"],
    })
  })

  it("merges base settings with overrides", () => {
    expect(
      mergeProjectSettingsRecords(FLEET_PI_BASE_PROJECT_SETTINGS, {
        defaultModel: "gemini-3.1-pro-preview",
      }).defaultModel
    ).toBe("gemini-3.1-pro-preview")
  })
})
