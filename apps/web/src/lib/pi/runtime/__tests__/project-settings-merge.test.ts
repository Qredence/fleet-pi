import { afterEach, describe, expect, it } from "vitest"
import {
  FLEET_PI_SHARED_PROJECT_SETTINGS,
  getFleetBaseProjectSettings,
} from "../fleet-default-project-settings"
import {
  compactProjectSettingsForPersist,
  isAllowAllEnabledModels,
  mergeProjectSettingsRecords,
} from "../project-settings-merge"

const originalVercel = process.env.VERCEL

afterEach(() => {
  if (originalVercel === undefined) delete process.env.VERCEL
  else process.env.VERCEL = originalVercel
})

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
      compactProjectSettingsForPersist(
        {
          ...FLEET_PI_SHARED_PROJECT_SETTINGS,
          enabledModels: ["google/*", "/*"],
        },
        FLEET_PI_SHARED_PROJECT_SETTINGS
      )
    ).toEqual({})
  })

  it("returns empty overrides when merged equals base", () => {
    expect(
      compactProjectSettingsForPersist(
        { ...FLEET_PI_SHARED_PROJECT_SETTINGS },
        FLEET_PI_SHARED_PROJECT_SETTINGS
      )
    ).toEqual({})
  })

  it("omits workspace resource paths that match Fleet base defaults", () => {
    expect(
      compactProjectSettingsForPersist(
        {
          ...FLEET_PI_SHARED_PROJECT_SETTINGS,
          skills: ["../agent-workspace/pi/skills"],
          prompts: ["../agent-workspace/pi/prompts"],
          extensions: ["../agent-workspace/pi/extensions/enabled"],
        },
        FLEET_PI_SHARED_PROJECT_SETTINGS
      )
    ).toEqual({})
  })

  it("keeps workspace resource path overrides", () => {
    expect(
      compactProjectSettingsForPersist(
        {
          ...FLEET_PI_SHARED_PROJECT_SETTINGS,
          skills: ["../agent-workspace/pi/skills/custom-skill"],
        },
        FLEET_PI_SHARED_PROJECT_SETTINGS
      )
    ).toEqual({
      skills: ["../agent-workspace/pi/skills/custom-skill"],
    })
  })

  it("strips auto-discovered .pi resource paths from persisted overrides", () => {
    expect(
      compactProjectSettingsForPersist(
        {
          ...FLEET_PI_SHARED_PROJECT_SETTINGS,
          extensions: [
            "extensions/project-inventory",
            "../agent-workspace/pi/extensions/enabled/foo.ts",
          ],
          skills: ["skills", "../agent-workspace/pi/skills/helper"],
        },
        FLEET_PI_SHARED_PROJECT_SETTINGS
      )
    ).toEqual({
      extensions: ["../agent-workspace/pi/extensions/enabled/foo.ts"],
      skills: ["../agent-workspace/pi/skills/helper"],
    })
  })

  it("merges base settings with overrides", () => {
    expect(
      mergeProjectSettingsRecords(FLEET_PI_SHARED_PROJECT_SETTINGS, {
        defaultModel: "gemini-3.1-pro-preview",
      }).defaultModel
    ).toBe("gemini-3.1-pro-preview")
  })

  it("preserves a deny-all enabledModels override on base settings", () => {
    expect(
      compactProjectSettingsForPersist(
        {
          ...FLEET_PI_SHARED_PROJECT_SETTINGS,
          enabledModels: [],
        },
        FLEET_PI_SHARED_PROJECT_SETTINGS
      )
    ).toEqual({ enabledModels: [] })
  })

  it("omits model defaults everywhere: base settings carry no default provider/model locally or deployed", () => {
    delete process.env.VERCEL
    const localBase = getFleetBaseProjectSettings()
    expect(localBase).toEqual({ ...FLEET_PI_SHARED_PROJECT_SETTINGS })
    expect(localBase).not.toHaveProperty("defaultProvider")
    expect(localBase).not.toHaveProperty("defaultModel")
    expect(localBase).not.toHaveProperty("enabledModels")

    process.env.VERCEL = "1"
    const deployedBase = getFleetBaseProjectSettings()
    expect(deployedBase).toEqual({ ...FLEET_PI_SHARED_PROJECT_SETTINGS })
    expect(deployedBase).not.toHaveProperty("defaultProvider")
    expect(deployedBase).not.toHaveProperty("defaultModel")
    expect(deployedBase).not.toHaveProperty("enabledModels")
  })
})
