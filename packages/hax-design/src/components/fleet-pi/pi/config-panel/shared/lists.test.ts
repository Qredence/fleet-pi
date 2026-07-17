import { describe, expect, it } from "vitest"
import {
  addUniqueSettingsResource,
  resourceOptionValue,
  settingsResourceListIncludes,
  toSettingsResourcePath,
} from "./settings-resource-path"

describe("resourceOptionValue", () => {
  it("ignores provenance sources and maps project extension paths", () => {
    expect(
      resourceOptionValue({
        name: "bedrock-bearer-auth",
        source: "auto",
        path: "/Volumes/fleet-pi/.pi/extensions/bedrock-bearer-auth.ts",
      })
    ).toBe("extensions/bedrock-bearer-auth.ts")
  })

  it("keeps package sources as settings values", () => {
    expect(
      resourceOptionValue({
        name: "src",
        source: "npm:pi-autocontext",
        path: "/Volumes/fleet-pi/.pi/npm/node_modules/pi-autocontext/src/index.ts",
      })
    ).toBe("npm:pi-autocontext")
  })

  it("maps workspace paths relative to the project", () => {
    expect(
      resourceOptionValue({
        name: "explorator-agent",
        source: "local",
        path: "/Volumes/fleet-pi/agent-workspace/.pi/extensions/enabled/explorator-agent.ts",
      })
    ).toBe("../agent-workspace/.pi/extensions/enabled/explorator-agent.ts")
  })

  it("prefers workspacePath over absolute path", () => {
    expect(
      resourceOptionValue({
        name: "frontend-helper",
        source: "workspace",
        path: "/Volumes/fleet-pi/agent-workspace/pi/skills/frontend-helper/SKILL.md",
        workspacePath: "agent-workspace/pi/skills/frontend-helper/SKILL.md",
      })
    ).toBe("../agent-workspace/pi/skills/frontend-helper")
  })

  it("prefixes relative agent-workspace paths for Pi settings", () => {
    expect(
      toSettingsResourcePath(
        "agent-workspace/pi/skills/frontend-helper/SKILL.md"
      )
    ).toBe("../agent-workspace/pi/skills/frontend-helper")
  })

  it("does not collapse distinct auto-loaded extensions to one option", () => {
    const values = [
      resourceOptionValue({
        name: "project-inventory",
        source: "auto",
        path: "/repo/.pi/extensions/project-inventory.ts",
      }),
      resourceOptionValue({
        name: "workspace-index",
        source: "auto",
        path: "/repo/.pi/extensions/workspace-index.ts",
      }),
    ]

    expect(values).toEqual([
      "extensions/project-inventory.ts",
      "extensions/workspace-index.ts",
    ])
  })
})

describe("toSettingsResourcePath", () => {
  it("strips vendor index suffixes", () => {
    expect(
      toSettingsResourcePath("/repo/.pi/extensions/vendor/filechanges/index.ts")
    ).toBe("extensions/vendor/filechanges")
  })

  it("preserves direct prompt filenames", () => {
    expect(toSettingsResourcePath("/repo/.pi/prompts/release-check.md")).toBe(
      "prompts/release-check.md"
    )
  })
})

describe("settingsResourceListIncludes / addUniqueSettingsResource", () => {
  it("treats absolute and remapped paths as the same membership", () => {
    const values = ["/repo/.pi/extensions/project-inventory.ts"]

    expect(
      settingsResourceListIncludes(values, "extensions/project-inventory.ts")
    ).toBe(true)
    expect(
      addUniqueSettingsResource(values, "extensions/project-inventory.ts")
    ).toEqual(values)
  })

  it("appends the canonical form when no equivalent exists", () => {
    expect(
      addUniqueSettingsResource(
        ["extensions/workspace-index.ts"],
        "/repo/.pi/extensions/project-inventory.ts"
      )
    ).toEqual([
      "extensions/workspace-index.ts",
      "extensions/project-inventory.ts",
    ])
  })
})
