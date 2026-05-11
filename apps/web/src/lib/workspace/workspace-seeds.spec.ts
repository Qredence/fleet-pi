import { readFile, readdir } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const REPO_ROOT = resolve(
  fileURLToPath(new URL("../../../../../", import.meta.url))
)

const EXPECTED_CANONICAL_MEMORY_TEMPLATES: Record<string, string> = {
  "architecture.md": [
    "# Architecture",
    "",
    "Status: Seeded stub.",
    "",
    "Use this file for durable, repo-grounded architecture notes.",
    "",
    "Suggested sections:",
    "",
    "- Stable structure",
    "- Runtime boundaries",
    "- Key data flows",
    "- Source anchors",
    "",
  ].join("\n"),
  "decisions.md": [
    "# Decisions",
    "",
    "Status: Seeded stub.",
    "",
    "Use this file for durable project decisions and their rationale.",
    "",
    "Template:",
    "",
    "## Decision",
    "",
    "- Decision:",
    "- Status:",
    "- Date:",
    "- Context:",
    "- Rationale:",
    "- Consequences:",
    "- Source:",
    "",
  ].join("\n"),
  "preferences.md": [
    "# Preferences",
    "",
    "Status: Seeded stub.",
    "",
    "Use this file for stable user or project preferences that repeatedly affect how",
    "work should be done.",
    "",
    "Template:",
    "",
    "## Preference",
    "",
    "- Preference:",
    "- Applies to:",
    "- Why it matters:",
    "- Evidence:",
    "- Last confirmed:",
    "",
  ].join("\n"),
  "open-questions.md": [
    "# Open Questions",
    "",
    "Status: Seeded stub.",
    "",
    "Use this file for unresolved questions that block design clarity or repeatedly",
    "surface during implementation.",
    "",
    "Template:",
    "",
    "## Question",
    "",
    "- Question:",
    "- Why it matters:",
    "- Current evidence:",
    "- Next step:",
    "- Owner:",
    "",
  ].join("\n"),
  "known-issues.md": [
    "# Known Issues",
    "",
    "Status: Seeded stub.",
    "",
    "Use this file for durable issues or rough edges that future agents should keep",
    "in mind.",
    "",
    "Template:",
    "",
    "## Issue",
    "",
    "- Issue:",
    "- Affected area:",
    "- Symptoms:",
    "- Current status:",
    "- Workaround:",
    "- Follow-up:",
    "",
  ].join("\n"),
}

const EXPECTED_BACKLOG_TEMPLATE = [
  "# Plan Backlog",
  "",
  "Status: Seeded stub.",
  "",
  "Use this file for candidate plans or follow-up work worth revisiting later.",
  "",
  "Template:",
  "",
  "## Candidate plan",
  "",
  "- Goal:",
  "- Why now:",
  "- Inputs:",
  "- Next step:",
  "",
].join("\n")

describe("clean clone workspace seeds", () => {
  it("keeps canonical project memory files as neutral starter templates", async () => {
    const projectMemoryDir = resolve(
      REPO_ROOT,
      "agent-workspace/memory/project"
    )
    const entries = (await readdir(projectMemoryDir))
      .filter((entry) => entry.endsWith(".md"))
      .sort((left, right) => left.localeCompare(right))

    expect(entries).toEqual(
      Object.keys(EXPECTED_CANONICAL_MEMORY_TEMPLATES).sort((left, right) =>
        left.localeCompare(right)
      )
    )

    await Promise.all(
      entries.map(async (entry) => {
        const content = await readFile(resolve(projectMemoryDir, entry), "utf8")
        expect(content).toBe(EXPECTED_CANONICAL_MEMORY_TEMPLATES[entry])
      })
    )
  })

  it("removes maintainer-enriched user workspace seeds from fresh clones", async () => {
    const dailyEntries = await readdir(
      resolve(REPO_ROOT, "agent-workspace/memory/daily")
    )
    const researchEntries = await readdir(
      resolve(REPO_ROOT, "agent-workspace/memory/research")
    )
    const reportEntries = await readdir(
      resolve(REPO_ROOT, "agent-workspace/artifacts/reports")
    )
    const backlog = await readFile(
      resolve(REPO_ROOT, "agent-workspace/plans/backlog.md"),
      "utf8"
    )

    expect(
      dailyEntries.sort((left, right) => left.localeCompare(right))
    ).toEqual([".gitkeep"])
    expect(
      researchEntries.sort((left, right) => left.localeCompare(right))
    ).toEqual(["index.md"])
    expect(
      reportEntries.sort((left, right) => left.localeCompare(right))
    ).toEqual([".gitkeep"])
    expect(backlog).toBe(EXPECTED_BACKLOG_TEMPLATE)
  })
})
