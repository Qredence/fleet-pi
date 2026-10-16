import { describe, expect, it, vi } from "vitest"
import { runWithChatAuthSurface } from "../../../auth/chat-auth-surface"
import {
  FLEET_PI_SHARED_PROJECT_SETTINGS,
  getFleetBaseProjectSettings,
  omitRemoteInstallPackages,
} from "../fleet-default-project-settings"
import { prepareProjectSettingsForPersist } from "../project-settings-persist"

const SHARED_NPM_PACKAGES = [...FLEET_PI_SHARED_PROJECT_SETTINGS.packages]

describe("getFleetBaseProjectSettings", () => {
  it("omits npm packages on the neon-function surface but keeps local resource paths", () => {
    runWithChatAuthSurface("neon-function", () => {
      const settings = getFleetBaseProjectSettings()
      expect(settings.packages).toEqual([])
      expect(settings.skills).toEqual(["../agent-workspace/pi/skills"])
      expect(settings.prompts).toEqual(["../agent-workspace/pi/prompts"])
      expect(settings.extensions).toEqual([
        "../agent-workspace/pi/extensions/enabled",
      ])
    })
  })

  it("drops remote package installs from the loader view on Cloudflare", () => {
    vi.stubEnv("FLEET_PI_DEPLOYMENT", "cloudflare")
    expect(
      omitRemoteInstallPackages({
        packages: [
          "npm:pi-web-access",
          { source: "git:github.com/example/pack" },
          "github:example/pack",
          "../agent-workspace/pi/packages/bundle",
        ],
        skills: ["../agent-workspace/pi/skills"],
      })
    ).toEqual({
      packages: ["../agent-workspace/pi/packages/bundle"],
      skills: ["../agent-workspace/pi/skills"],
    })
    vi.unstubAllEnvs()
  })

  it("keeps remote package installs in the loader view off the hosted runtime", () => {
    expect(
      omitRemoteInstallPackages({
        packages: [
          "npm:pi-web-access",
          "../agent-workspace/pi/packages/bundle",
        ],
      })
    ).toEqual({
      packages: ["npm:pi-web-access", "../agent-workspace/pi/packages/bundle"],
    })
  })

  it("returns the full shared settings on the default web surface", () => {
    const settings = getFleetBaseProjectSettings()
    expect(settings.packages).toEqual(SHARED_NPM_PACKAGES)
    expect(settings.skills).toEqual(["../agent-workspace/pi/skills"])
    expect(settings.prompts).toEqual(["../agent-workspace/pi/prompts"])
    expect(settings.extensions).toEqual([
      "../agent-workspace/pi/extensions/enabled",
    ])
  })
})

describe("prepareProjectSettingsForPersist compaction per surface", () => {
  it("keeps a non-empty packages override on the neon-function surface", () => {
    runWithChatAuthSurface("neon-function", () => {
      expect(
        prepareProjectSettingsForPersist({ packages: ["npm:pi-web-access"] })
      ).toEqual({ packages: ["npm:pi-web-access"] })
    })
  })

  it("strips an empty packages override on the neon-function surface", () => {
    runWithChatAuthSurface("neon-function", () => {
      expect(prepareProjectSettingsForPersist({ packages: [] })).toEqual({})
    })
  })

  it("strips a packages override equal to the shared npm list on the web surface", () => {
    expect(
      prepareProjectSettingsForPersist({ packages: SHARED_NPM_PACKAGES })
    ).toEqual({})
  })

  it("keeps any other non-empty packages override on the web surface", () => {
    expect(
      prepareProjectSettingsForPersist({ packages: ["npm:pi-web-access"] })
    ).toEqual({ packages: ["npm:pi-web-access"] })
  })
})
