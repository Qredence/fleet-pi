import { join } from "node:path"

import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent"
import { describe, expect, it } from "vitest"

import { findRepoRoot } from "../../app-runtime"
import { FLEET_PI_SHARED_PROJECT_SETTINGS } from "../../pi/runtime/fleet-default-project-settings"

const repoRoot = findRepoRoot(process.cwd())

describe("workspace skills root", () => {
  it("is the only workspace skill path Pi is configured to load", () => {
    expect(FLEET_PI_SHARED_PROJECT_SETTINGS.skills).toEqual([
      "../agent-workspace/pi/skills",
    ])
  })

  it.each([
    ["seed template", "templates/agent-workspace/pi/skills"],
    ["team workspace", "agent-workspace/pi/skills"],
  ])("loads every %s skill without diagnostics", (_label, dir) => {
    const result = loadSkillsFromDir({
      dir: join(repoRoot, dir),
      source: "test",
    })

    expect(result.diagnostics).toEqual([])
    expect(result.skills.length).toBeGreaterThan(0)
    for (const skill of result.skills) {
      expect(skill.description.length).toBeGreaterThan(0)
    }
  })

  it("loads the team skills that used to sit in the legacy skills/ root", () => {
    const names = loadSkillsFromDir({
      dir: join(repoRoot, "agent-workspace/pi/skills"),
      source: "test",
    }).skills.map((skill) => skill.name)

    expect(names).toEqual(
      expect.arrayContaining([
        "codebase-research",
        "doc-gardening",
        "execution-plan",
        "frontend-design",
        "memory-synthesis",
      ])
    )
  })
})
