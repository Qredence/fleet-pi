import { readFile, readdir } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const REPO_ROOT = resolve(
  fileURLToPath(new URL("../../../../../", import.meta.url))
)

const EXPECTED_CANONICAL_MEMORY_MARKERS: Record<string, string> = {
  "architecture.md": "`agent-workspace/` is Fleet Pi’s durable adaptive layer",
  "decisions.md":
    "Treat `agent-workspace/` as Fleet Pi’s persistent agent operating surface",
  "known-issues.md":
    "The canonical project memory files existed as seeded stubs",
  "open-questions.md":
    "Should Fleet Pi build its own workspace-native memory lifecycle first",
  "preferences.md":
    "Prefer small, focused, reviewable diffs over broad rewrites",
}

const EXPECTED_REPORT_SEEDS = [
  ".gitkeep",
  "architecture-review-2026-05-12.md",
].sort((left, right) => left.localeCompare(right))

describe("clean clone workspace seeds", () => {
  it("keeps canonical project memory files as durable workspace memory", async () => {
    const projectMemoryDir = resolve(
      REPO_ROOT,
      "agent-workspace/memory/project"
    )
    const entries = (await readdir(projectMemoryDir))
      .filter((entry) => entry.endsWith(".md"))
      .sort((left, right) => left.localeCompare(right))

    expect(entries).toEqual(
      Object.keys(EXPECTED_CANONICAL_MEMORY_MARKERS).sort((left, right) =>
        left.localeCompare(right)
      )
    )

    await Promise.all(
      entries.map(async (entry) => {
        const content = await readFile(resolve(projectMemoryDir, entry), "utf8")
        expect(content).not.toContain("Status: Seeded stub.")
        expect(content).toContain(EXPECTED_CANONICAL_MEMORY_MARKERS[entry])
      })
    )
  })

  it("keeps scratch daily seeds clean while preserving durable workspace artifacts", async () => {
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
    expect(researchEntries).toContain("index.md")
    expect(reportEntries).toEqual(expect.arrayContaining(EXPECTED_REPORT_SEEDS))
    expect(backlog).not.toContain("Status: Seeded stub.")
    expect(backlog).toContain("## Candidate plan: prompt-aware memory recall")
    expect(backlog).toContain(
      "## Candidate plan: self-improvement candidate extraction"
    )
  })
})
