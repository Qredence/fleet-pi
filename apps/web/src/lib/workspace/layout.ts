import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

export const AGENT_WORKSPACE_DIRECTORY = "agent-workspace"

const WORKSPACE_DIRECTORIES = [
  "system",
  "memory/daily",
  "memory/project",
  "memory/research",
  "skills/codebase-research",
  "skills/memory-synthesis",
  "artifacts/reports",
  "artifacts/diagrams",
  "artifacts/datasets",
  "artifacts/traces",
  "scratch/tmp",
]

const WORKSPACE_FILES = new Map<string, string>([
  [
    "system/identity.md",
    stub("Identity", "Define the agent workspace identity."),
  ],
  [
    "system/behavior.md",
    stub(
      "Behavior",
      "Capture behavioral defaults for agents using this workspace."
    ),
  ],
  [
    "system/constraints.md",
    stub("Constraints", "Record hard operating constraints and boundaries."),
  ],
  [
    "system/tool-policy.md",
    stub("Tool Policy", "Describe tool usage policy and safety expectations."),
  ],
  [
    "memory/daily/2026-05-01.md",
    stub("2026-05-01", "Daily notes and session observations."),
  ],
  [
    "memory/project/decisions.md",
    stub("Decisions", "Durable project decisions and rationale."),
  ],
  [
    "memory/project/architecture.md",
    stub("Architecture", "Architecture notes and system maps."),
  ],
  [
    "memory/project/open-questions.md",
    stub("Open Questions", "Unresolved questions and follow-up prompts."),
  ],
  [
    "memory/project/preferences.md",
    stub("Preferences", "User and project preferences to preserve."),
  ],
  ["memory/research/hermes.md", stub("Hermes", "Research notes for Hermes.")],
  [
    "memory/research/openclaw.md",
    stub("OpenClaw", "Research notes for OpenClaw."),
  ],
  ["memory/research/letta.md", stub("Letta", "Research notes for Letta.")],
  [
    "memory/research/factory.md",
    stub("Factory", "Research notes for Factory."),
  ],
  [
    "memory/research/evoskill.md",
    stub("EvoSkill", "Research notes for EvoSkill."),
  ],
  [
    "skills/codebase-research/skill.md",
    stub(
      "Codebase Research Skill",
      "Instructions for codebase research workflows."
    ),
  ],
  [
    "skills/codebase-research/examples.md",
    stub(
      "Codebase Research Examples",
      "Examples for using the codebase research skill."
    ),
  ],
  [
    "skills/codebase-research/evals.md",
    stub(
      "Codebase Research Evals",
      "Evaluation notes for the codebase research skill."
    ),
  ],
  [
    "skills/memory-synthesis/skill.md",
    stub(
      "Memory Synthesis Skill",
      "Instructions for synthesizing workspace memory."
    ),
  ],
  [
    "skills/memory-synthesis/changelog.md",
    stub(
      "Memory Synthesis Changelog",
      "Track changes to the memory synthesis skill."
    ),
  ],
])

function stub(title: string, purpose: string) {
  return `# ${title}\n\nPurpose: ${purpose}\n\nStatus: Seeded stub.\n`
}

export async function seedAgentWorkspace(workspaceRoot: string) {
  await mkdir(workspaceRoot, { recursive: true })

  for (const directory of WORKSPACE_DIRECTORIES) {
    await mkdir(join(workspaceRoot, directory), { recursive: true })
  }

  for (const [filePath, contents] of WORKSPACE_FILES) {
    try {
      await writeFile(join(workspaceRoot, filePath), contents, { flag: "wx" })
    } catch (error) {
      if (!isNodeError(error) || error.code !== "EEXIST") throw error
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}
