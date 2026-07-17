import { readdir, readFile, stat } from "node:fs/promises"
import { resolve } from "node:path"

// Canonical memory constant — inlined from .pi/extensions/lib/workspace-memory-index.ts
// to keep this analysis engine self-contained in the workspace layer.
const PROJECT_MEMORY_DIR = "agent-workspace/memory/project"
const CANONICAL_PROJECT_MEMORY_FILES = [
  {
    key: "architecture",
    path: `${PROJECT_MEMORY_DIR}/architecture.md`,
    title: "Architecture",
  },
  {
    key: "decisions",
    path: `${PROJECT_MEMORY_DIR}/decisions.md`,
    title: "Decisions",
  },
  {
    key: "preferences",
    path: `${PROJECT_MEMORY_DIR}/preferences.md`,
    title: "Preferences",
  },
  {
    key: "open-questions",
    path: `${PROJECT_MEMORY_DIR}/open-questions.md`,
    title: "Open Questions",
  },
  {
    key: "known-issues",
    path: `${PROJECT_MEMORY_DIR}/known-issues.md`,
    title: "Known Issues",
  },
] as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FindingSeverity = "info" | "warning" | "critical"

export type FindingCategory =
  | "canonical-memory"
  | "plan-hygiene"
  | "skill-integrity"
  | "crossref-integrity"
  | "boundary-compliance"
  | "self-improvement-loop"
  | "staleness"
  | "orphaned-files"

export type Finding = {
  category: FindingCategory
  severity: FindingSeverity
  title: string
  description: string
  suggestion: string
  target?: string
}

export type ImprovementReport = {
  summary: {
    totalFindings: number
    bySeverity: Record<FindingSeverity, number>
    byCategory: Partial<Record<FindingCategory, number>>
  }
  findings: Array<Finding>
  workspaceStats: {
    totalFiles: number
    totalDirs: number
    canonicalMemoryFiles: number
    orphanedMemoryFiles: number
    activePlans: number
    completedPlans: number
    skills: number
    evals: number
  }
}

const WORKSPACE_ROOT = "agent-workspace"
const ALL_SEVERITIES: Array<FindingSeverity> = ["critical", "warning", "info"]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function analyzeWorkspace(
  cwd: string,
  options?: {
    filterCategories?: Array<FindingCategory>
    minSeverity?: FindingSeverity
  }
): Promise<ImprovementReport> {
  const findings: Array<Finding> = []

  // Collect workspace stats
  const workspacePath = resolve(cwd, WORKSPACE_ROOT)
  const stats = await collectWorkspaceStats(cwd, workspacePath)

  // Run all analysis passes
  findings.push(...(await analyzeCanonicalMemory(cwd, stats)))
  findings.push(...(await analyzePlanHygiene(cwd, stats)))
  findings.push(...(await analyzeSkillIntegrity(cwd, stats)))
  findings.push(...(await analyzeCrossRefIntegrity(cwd)))
  findings.push(...(await analyzeBoundaryCompliance(cwd)))
  findings.push(...(await analyzeSelfImprovementLoop(cwd, stats)))
  findings.push(...(await analyzeStaleness(cwd)))
  findings.push(...(await analyzeOrphanedFiles(cwd, stats)))

  // Filter
  let filtered = findings
  if (options?.filterCategories && options.filterCategories.length > 0) {
    const cats = new Set(options.filterCategories)
    filtered = filtered.filter((f) => cats.has(f.category))
  }
  if (options?.minSeverity) {
    const minIdx = ALL_SEVERITIES.indexOf(options.minSeverity)
    filtered = filtered.filter(
      (f) => ALL_SEVERITIES.indexOf(f.severity) <= minIdx
    )
  }

  // Deduplicate by title
  const seen = new Set<string>()
  const deduped: Array<Finding> = []
  for (const f of filtered) {
    const key = `${f.category}:${f.title}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(f)
    }
  }

  // Sort: critical → warning → info, then by category
  deduped.sort((a, b) => {
    const sevOrder =
      ALL_SEVERITIES.indexOf(a.severity) - ALL_SEVERITIES.indexOf(b.severity)
    if (sevOrder !== 0) return sevOrder
    return a.category.localeCompare(b.category)
  })

  const bySeverity: Record<FindingSeverity, number> = {
    critical: 0,
    warning: 0,
    info: 0,
  }
  const byCategory: Partial<Record<FindingCategory, number>> = {}

  for (const f of deduped) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1
  }

  return {
    summary: {
      totalFindings: deduped.length,
      bySeverity,
      byCategory,
    },
    findings: deduped,
    workspaceStats: stats,
  }
}

// ---------------------------------------------------------------------------
// Workspace Stats Collector
// ---------------------------------------------------------------------------

type WorkspaceStats = {
  totalFiles: number
  totalDirs: number
  canonicalMemoryFiles: number
  orphanedMemoryFiles: number
  activePlans: number
  completedPlans: number
  skills: number
  evals: number
}

async function collectWorkspaceStats(
  cwd: string,
  workspacePath: string
): Promise<WorkspaceStats> {
  let totalFiles = 0
  let totalDirs = 0

  // Count files and dirs recursively
  async function walk(dir: string) {
    let entries: Array<string> = []
    try {
      entries = await readdir(dir, { withFileTypes: true }).then((e) =>
        e.map((e) => e.name)
      )
    } catch {
      return
    }
    for (const entry of entries) {
      const fullPath = resolve(dir, entry)
      try {
        const info = await stat(fullPath)
        if (info.isDirectory()) {
          totalDirs++
          await walk(fullPath)
        } else {
          totalFiles++
        }
      } catch {
        // skip unreadable
      }
    }
  }
  try {
    await stat(workspacePath)
    await walk(workspacePath)
  } catch {
    // workspace doesn't exist
  }

  // Count canonical memory files with content
  let canonicalMemoryFiles = 0
  for (const mem of CANONICAL_PROJECT_MEMORY_FILES) {
    const content = await readSafe(resolve(cwd, mem.path), "")
    if (content.length > 50 && !content.includes("Seeded stub")) {
      canonicalMemoryFiles++
    }
  }

  // Count orphaned memory files
  const projectMemoryDir = resolve(cwd, `${WORKSPACE_ROOT}/memory/project`)
  let orphanedMemoryFiles = 0
  try {
    const entries = await readdir(projectMemoryDir, { withFileTypes: true })
    const canonicalPaths = new Set(
      CANONICAL_PROJECT_MEMORY_FILES.map((m) => resolve(cwd, m.path))
    )
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        const full = resolve(projectMemoryDir, entry.name)
        if (!canonicalPaths.has(full)) {
          orphanedMemoryFiles++
        }
      }
    }
  } catch {
    // no project memory dir
  }

  // Count plans
  let activePlans = 0
  let completedPlans = 0
  try {
    activePlans = (
      await readdir(resolve(cwd, `${WORKSPACE_ROOT}/plans/active`))
    ).filter((n) => n.endsWith(".md")).length
  } catch {
    /* empty */
  }
  try {
    completedPlans = (
      await readdir(resolve(cwd, `${WORKSPACE_ROOT}/plans/completed`))
    ).filter((n) => n.endsWith(".md")).length
  } catch {
    /* empty */
  }

  // Count skills
  let skills = 0
  try {
    const skillDirs = await readdir(resolve(cwd, `${WORKSPACE_ROOT}/skills`), {
      withFileTypes: true,
    })
    skills = skillDirs.filter((d) => d.isDirectory()).length
  } catch {
    /* empty */
  }

  // Count evals
  let evals = 0
  try {
    evals = (await readdir(resolve(cwd, `${WORKSPACE_ROOT}/evals`))).filter(
      (n) => n.endsWith(".md")
    ).length
  } catch {
    /* empty */
  }

  return {
    totalFiles,
    totalDirs,
    canonicalMemoryFiles,
    orphanedMemoryFiles,
    activePlans,
    completedPlans,
    skills,
    evals,
  }
}

// ---------------------------------------------------------------------------
// Analysis Passes
// ---------------------------------------------------------------------------

/**
 * 1. Canonical Memory Health
 */
async function analyzeCanonicalMemory(
  cwd: string,
  _stats: WorkspaceStats
): Promise<Array<Finding>> {
  const findings: Array<Finding> = []

  for (const mem of CANONICAL_PROJECT_MEMORY_FILES) {
    const content = await readSafe(resolve(cwd, mem.path), "")

    if (!content) {
      findings.push({
        category: "canonical-memory",
        severity: "critical",
        title: `Missing canonical memory file: ${mem.key}`,
        description: `${mem.path} does not exist or is empty. This file is one of the five canonical project memory files that Fleet Pi's prompt-aware retrieval depends on.`,
        suggestion: `Create ${mem.path} with substantive content covering ${mem.title} facts.`,
        target: mem.path,
      })
      continue
    }

    if (content.includes("Seeded stub") || content.length < 100) {
      findings.push({
        category: "canonical-memory",
        severity: "warning",
        title: `Canonical memory file has only stub content: ${mem.key}`,
        description: `${mem.path} appears to be a seeded stub rather than enriched content. It's ${content.length} chars and may contain the stub marker.`,
        suggestion: `Enrich ${mem.path} with durable, source-linked facts about ${mem.title}.`,
        target: mem.path,
      })
      continue
    }

    // Check for section count
    const sections = content
      .split("\n")
      .filter((l) => /^#{2,3}\s+/.test(l.trim()))
    if (sections.length < 2) {
      findings.push({
        category: "canonical-memory",
        severity: "info",
        title: `Canonical memory file has few sections: ${mem.key}`,
        description: `${mem.path} has only ${sections.length} section(s). Well-structured memory files typically have 3+ sections covering distinct aspects.`,
        suggestion: `Consider adding more sections to ${mem.path} for broader recall coverage.`,
        target: mem.path,
      })
    }
  }

  return findings
}

/**
 * 2. Plan Hygiene
 */
async function analyzePlanHygiene(
  cwd: string,
  _stats: WorkspaceStats
): Promise<Array<Finding>> {
  const findings: Array<Finding> = []

  // Active plans
  const activeDir = resolve(cwd, `${WORKSPACE_ROOT}/plans/active`)
  try {
    const activeFiles = (await readdir(activeDir)).filter((n) =>
      n.endsWith(".md")
    )

    if (activeFiles.length === 0) {
      findings.push({
        category: "plan-hygiene",
        severity: "info",
        title: "No active plans",
        description:
          "There are no active plans in plans/active/. The workspace has no tracked active work items.",
        suggestion:
          "Promote a backlog candidate to plans/active/ or create a new plan if work is ongoing.",
        target: "agent-workspace/plans/active/",
      })
    }

    for (const file of activeFiles) {
      const content = await readSafe(resolve(activeDir, file), "")
      const ageDays = await estimateAgeDays(resolve(activeDir, file))

      const hasStepsSection = content.includes("## Steps")
      const hasCheckboxes = /-\s*\[[xX]\]/.test(content)
      const hasEmojiDone = /✅|✔️|✓|Done|Complete/i.test(
        content.substring(
          0,
          content.indexOf("## Follow-up") >= 0
            ? content.indexOf("## Follow-up")
            : content.length
        )
      )
      const statusIsComplete =
        /\*\*Status:\*\*\s*(Done|Complete|Finished|Resolved)/i.test(content)

      if (
        hasStepsSection &&
        !hasCheckboxes &&
        !hasEmojiDone &&
        !statusIsComplete
      ) {
        findings.push({
          category: "plan-hygiene",
          severity: "warning",
          title: `Active plan may have unmarked progress: ${file}`,
          description: `${file} in plans/active/ has a Steps section but no completed-step markers detected ([x] or ✅). It's been ${ageDays}d since last modification.`,
          suggestion:
            "Review and either advance the plan, move it to abandoned/ with rationale, or add completed-step markers.",
          target: `agent-workspace/plans/active/${file}`,
        })
      }

      // Check if plan is very old
      if (ageDays > 30) {
        findings.push({
          category: "plan-hygiene",
          severity: "info",
          title: `Active plan is stale: ${file} (${ageDays}d old)`,
          description: `${file} was last modified ${ageDays} days ago. Long-idle active plans may no longer reflect current priorities.`,
          suggestion: `Review ${file}, advance it, or move it to completed/ or abandoned/.`,
          target: `agent-workspace/plans/active/${file}`,
        })
      }
    }
  } catch {
    findings.push({
      category: "plan-hygiene",
      severity: "warning",
      title: "Active plans directory not found",
      description:
        "agent-workspace/plans/active/ does not exist or is unreadable.",
      suggestion:
        "Create agent-workspace/plans/active/ directory and populate with plan files.",
      target: "agent-workspace/plans/active/",
    })
  }

  // Backlog freshness
  const backlogPath = resolve(cwd, `${WORKSPACE_ROOT}/plans/backlog.md`)
  const backlogContent = await readSafe(backlogPath, "")
  if (!backlogContent) {
    findings.push({
      category: "plan-hygiene",
      severity: "warning",
      title: "Backlog file missing",
      description:
        "agent-workspace/plans/backlog.md does not exist or is empty.",
      suggestion:
        "Create backlog.md with structured candidate plans derived from known-issues and open-questions.",
      target: "agent-workspace/plans/backlog.md",
    })
  } else {
    const backlogAge = await estimateAgeDays(backlogPath)
    if (backlogAge > 60) {
      findings.push({
        category: "plan-hygiene",
        severity: "info",
        title: `Backlog is stale (${backlogAge}d old)`,
        description: `plans/backlog.md hasn't been updated in ${backlogAge} days. Backlog candidates may no longer be relevant.`,
        suggestion:
          "Review and refresh backlog.md with current self-improvement candidates.",
        target: "agent-workspace/plans/backlog.md",
      })
    }
  }

  return findings
}

/**
 * 3. Skill Integrity
 */
async function analyzeSkillIntegrity(
  cwd: string,
  _stats: WorkspaceStats
): Promise<Array<Finding>> {
  const findings: Array<Finding> = []
  const skillsDir = resolve(cwd, `${WORKSPACE_ROOT}/skills`)

  let skillDirs: Array<string> = []
  try {
    const entries = await readdir(skillsDir, { withFileTypes: true })
    skillDirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
  } catch {
    findings.push({
      category: "skill-integrity",
      severity: "info",
      title: "No workspace skills directory",
      description:
        "agent-workspace/skills/ does not exist or is empty. Skills are optional but useful for encoding reusable procedures.",
      suggestion:
        "Consider adding skills when repeated patterns emerge during implementation work.",
      target: "agent-workspace/skills/",
    })
    return findings
  }

  for (const dir of skillDirs) {
    const skillPath = resolve(skillsDir, dir, "SKILL.md")
    const changelogPath = resolve(skillsDir, dir, "changelog.md")
    const evalsPath = resolve(skillsDir, dir, "evals.md")

    const hasSkill = await exists(skillPath)
    const hasChangelog = await exists(changelogPath)
    const hasEvals = await exists(evalsPath)

    if (!hasSkill) {
      findings.push({
        category: "skill-integrity",
        severity: "critical",
        title: `Missing SKILL.md for skill: ${dir}`,
        description: `Skill directory ${dir} exists but has no SKILL.md entry point. It cannot be loaded by Pi.`,
        suggestion: `Create agent-workspace/skills/${dir}/SKILL.md with when-to-use, procedure, and quality checklist sections.`,
        target: `agent-workspace/skills/${dir}/SKILL.md`,
      })
    }

    if (!hasChangelog && hasSkill) {
      findings.push({
        category: "skill-integrity",
        severity: "info",
        title: `Missing changelog for skill: ${dir}`,
        description: `Skill ${dir} has SKILL.md but no changelog.md. Changes to the skill won't be tracked for future agents.`,
        suggestion: `Create agent-workspace/skills/${dir}/changelog.md to track skill evolution.`,
        target: `agent-workspace/skills/${dir}/changelog.md`,
      })
    }

    if (!hasEvals && hasSkill) {
      findings.push({
        category: "skill-integrity",
        severity: "info",
        title: `Missing evals for skill: ${dir}`,
        description: `Skill ${dir} has SKILL.md but no evals.md. The skill's effectiveness cannot be evaluated.`,
        suggestion: `Create agent-workspace/skills/${dir}/evals.md with scored criteria and regression triggers.`,
        target: `agent-workspace/skills/${dir}/evals.md`,
      })
    }

    // Verify SKILL.md has proper structure
    if (hasSkill) {
      const content = await readSafe(skillPath, "")
      const hasProcedure = /##\s+(Procedure|Steps)/i.test(content)
      const hasQualityChecklist = /##\s+Quality/.test(content)

      if (!hasProcedure) {
        findings.push({
          category: "skill-integrity",
          severity: "warning",
          title: `SKILL.md missing Procedure section: ${dir}`,
          description: `SKILL.md for ${dir} lacks a ## Procedure or ## Steps section. Agents won't know the correct workflow.`,
          suggestion: `Add a ## Procedure section to agent-workspace/skills/${dir}/SKILL.md with numbered steps.`,
          target: `agent-workspace/skills/${dir}/SKILL.md`,
        })
      }

      if (!hasQualityChecklist) {
        findings.push({
          category: "skill-integrity",
          severity: "info",
          title: `SKILL.md missing Quality checklist: ${dir}`,
          description: `SKILL.md for ${dir} lacks a ## Quality checklist section for self-verification.`,
          suggestion: `Add a ## Quality checklist section to agent-workspace/skills/${dir}/SKILL.md.`,
          target: `agent-workspace/skills/${dir}/SKILL.md`,
        })
      }
    }
  }

  return findings
}

/**
 * 4. Cross-Reference Integrity
 */
async function analyzeCrossRefIntegrity(cwd: string): Promise<Array<Finding>> {
  const findings: Array<Finding> = []

  // Scan decisions.md for source references
  const decisionsPath = resolve(
    cwd,
    `${WORKSPACE_ROOT}/memory/project/decisions.md`
  )
  const content = await readSafe(decisionsPath, "")
  if (!content) return findings

  // Find lines with "Source:" references
  const sourceLines = content
    .split("\n")
    .filter((l) => /^-\s*Source:\s*/i.test(l) || /^-\s*Evidence:\s*/i.test(l))

  for (const line of sourceLines) {
    const refs = line
      .replace(/^- Source:\s*/i, "")
      .replace(/^- Evidence:\s*/i, "")
      .split(", ")
    for (const ref of refs) {
      const trimmed = ref.trim()
      if (!trimmed) continue

      // Only inspect file-path references (not URLs or package names)
      if (
        trimmed.startsWith("http") ||
        trimmed.includes("://") ||
        trimmed.startsWith("npm:") ||
        !trimmed.includes(".")
      ) {
        continue
      }

      const refPath = resolve(cwd, trimmed)
      const refExists = await exists(refPath)
      if (!refExists) {
        // Check if it might be relative to workspace root
        const workspaceRef = resolve(cwd, WORKSPACE_ROOT, trimmed)
        if (!(await exists(workspaceRef))) {
          findings.push({
            category: "crossref-integrity",
            severity: "critical",
            title: `Broken source reference in decisions.md: ${trimmed}`,
            description: `decisions.md references ${trimmed} as a source, but this file does not exist. Broken references reduce trust in decision provenance.`,
            suggestion: `Update the Source line in decisions.md to point to the correct file path, or remove it if the file was intentionally deleted.`,
            target: "agent-workspace/memory/project/decisions.md",
          })
        }
      }
    }
  }

  return findings
}

/**
 * 5. Boundary Compliance
 */
async function analyzeBoundaryCompliance(cwd: string): Promise<Array<Finding>> {
  const findings: Array<Finding> = []

  // Verify evals are not mutated outside of proper channels
  const evalsDir = resolve(cwd, `${WORKSPACE_ROOT}/evals`)
  try {
    const evalFiles = await readdir(evalsDir)
    for (const file of evalFiles) {
      if (!file.endsWith(".md")) continue
      const content = await readSafe(resolve(evalsDir, file), "")

      // Check for self-improvement policy answers (should be in system/, not evals/)
      if (
        content.includes("What failure or friction triggered this") &&
        content.includes("What changed")
      ) {
        findings.push({
          category: "boundary-compliance",
          severity: "info",
          title: `Eval file may contain self-improvement metadata: ${file}`,
          description: `${file} appears to include self-improvement policy fields. These belong in plans or system/ files, not evals.`,
          suggestion: `Move self-improvement metadata out of ${file} and into the appropriate plan or system file.`,
          target: `agent-workspace/evals/${file}`,
        })
      }
    }
  } catch {
    // evals directory missing — already reported elsewhere
  }

  // Check for scratch files with durable content
  const scratchDir = resolve(cwd, `${WORKSPACE_ROOT}/scratch/tmp`)
  try {
    const scratchFiles = await readdir(scratchDir)
    if (scratchFiles.length > 5) {
      findings.push({
        category: "boundary-compliance",
        severity: "info",
        title: `Scratch directory has many files (${scratchFiles.length})`,
        description: `agent-workspace/scratch/tmp/ has ${scratchFiles.length} files. Scratch space is ephemeral; accumulated content may hide durable learnings.`,
        suggestion:
          "Review scratch files for durable content worth synthesizing into memory/project/ or skills/, then clean up the rest.",
        target: "agent-workspace/scratch/tmp/",
      })
    }
  } catch {
    // scratch dir missing, fine
  }

  return findings
}

/**
 * 6. Self-Improvement Loop Health
 */
async function analyzeSelfImprovementLoop(
  cwd: string,
  _stats: WorkspaceStats
): Promise<Array<Finding>> {
  const findings: Array<Finding> = []

  // Check known-issues for unresolved issues that could become backlog candidates
  const knownIssuesPath = resolve(
    cwd,
    `${WORKSPACE_ROOT}/memory/project/known-issues.md`
  )
  const knownIssues = await readSafe(knownIssuesPath, "")

  // Find unresolved (non-resolved) known issues
  const unresolvedIssues: Array<string> = []
  if (knownIssues) {
    const sections = knownIssues.split(/^##\s+/m)
    for (const section of sections) {
      const title = section.split("\n")[0]?.trim()
      if (!title || /Resolved/i.test(section)) continue
      if (title === "Known Issues" || title === "Durable Issues") continue
      unresolvedIssues.push(title)
    }
  }

  // Check backlog for matching candidates
  const backlogContent = await readSafe(
    resolve(cwd, `${WORKSPACE_ROOT}/plans/backlog.md`),
    ""
  )

  if (unresolvedIssues.length > 0) {
    // Check each unresolved issue against backlog
    const backlogLower = backlogContent.toLowerCase()
    const unmatchedIssues = unresolvedIssues.filter(
      (issue) => !backlogLower.includes(issue.toLowerCase().slice(0, 30))
    )

    if (unmatchedIssues.length > 0) {
      findings.push({
        category: "self-improvement-loop",
        severity: "warning",
        title: `Unresolved known issues not represented in backlog (${unmatchedIssues.length})`,
        description: `The following known issues lack corresponding backlog candidates: ${unmatchedIssues.join(", ")}. The self-improvement pipeline is not closed.`,
        suggestion:
          "Add backlog candidates for each unresolved known issue to close the observe→propose loop.",
        target: "agent-workspace/plans/backlog.md",
      })
    }
  }

  // Check if eval files reference autocontext scenarios
  const evalsDir = resolve(cwd, `${WORKSPACE_ROOT}/evals`)
  try {
    const evalFiles = await readdir(evalsDir)
    let evalsWithoutScenarios = 0
    for (const file of evalFiles) {
      if (!file.endsWith(".md")) continue
      const content = await readSafe(resolve(evalsDir, file), "")
      if (
        !content.includes("autocontext") &&
        !content.includes("autocontext_judge") &&
        !content.includes("scenario")
      ) {
        evalsWithoutScenarios++
      }
    }
    if (evalsWithoutScenarios > 0) {
      findings.push({
        category: "self-improvement-loop",
        severity: "info",
        title: `${evalsWithoutScenarios} eval(s) not wired to autocontext`,
        description: `${evalsWithoutScenarios} eval .md files don't mention autocontext integration. They exist as documentation but aren't executable as automated eval scenarios.`,
        suggestion:
          "Register each eval as an autocontext scenario with rubric dimensions so they can run automatically via autocontext_judge.",
        target: "agent-workspace/evals/",
      })
    }
  } catch {
    // evals directory missing — already reported elsewhere
  }

  return findings
}

/**
 * 7. Staleness Detection
 */
async function analyzeStaleness(cwd: string): Promise<Array<Finding>> {
  const findings: Array<Finding> = []

  // Check key system files for staleness
  const systemFiles = [
    "agent-workspace/system/behavior.md",
    "agent-workspace/system/constraints.md",
    "agent-workspace/system/self-improvement-policy.md",
    "agent-workspace/system/workspace-policy.md",
    "agent-workspace/system/tool-policy.md",
    "agent-workspace/ARCHITECTURE.md",
  ]

  for (const file of systemFiles) {
    const ageDays = await estimateAgeDays(resolve(cwd, file))
    if (ageDays < 0) continue // file missing, skip
    if (ageDays > 90) {
      findings.push({
        category: "staleness",
        severity: "info",
        title: `System file may be stale: ${file} (${ageDays}d old)`,
        description: `${file} was last modified ${ageDays} days ago. System guidance should be reviewed periodically for accuracy.`,
        suggestion: `Review ${file} for accuracy. Update any references to code that may have moved or changed.`,
        target: file,
      })
    }
  }

  return findings
}

/**
 * 8. Orphaned Files Analysis
 */
async function analyzeOrphanedFiles(
  cwd: string,
  _stats: WorkspaceStats
): Promise<Array<Finding>> {
  const findings: Array<Finding> = []

  const projectMemoryDir = resolve(cwd, `${WORKSPACE_ROOT}/memory/project`)
  const canonicalPaths = new Set(
    CANONICAL_PROJECT_MEMORY_FILES.map((m) => resolve(cwd, m.path))
  )

  const orphanedPaths: Array<string> = []
  try {
    const entries = await readdir(projectMemoryDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        const fullPath = resolve(projectMemoryDir, entry.name)
        if (!canonicalPaths.has(fullPath)) {
          orphanedPaths.push(`agent-workspace/memory/project/${entry.name}`)
        }
      }
    }
  } catch {
    // project memory dir missing
  }

  if (orphanedPaths.length > 0) {
    findings.push({
      category: "orphaned-files",
      severity: "info",
      title: `${orphanedPaths.length} orphaned project memory file(s)`,
      description: `Files outside the canonical 5: ${orphanedPaths.join(", ")}. These won't be included in prompt-aware recall unless synthesized into canonical memory.`,
      suggestion:
        "Synthesize durable facts from orphaned files into the appropriate canonical memory file, or keep them if explicitly requested.",
      target: orphanedPaths[0],
    })
  }

  return findings
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readSafe(path: string, fallback: string): Promise<string> {
  try {
    return await readFile(path, "utf8")
  } catch {
    return fallback
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function estimateAgeDays(path: string): Promise<number> {
  try {
    const info = await stat(path)
    const diffMs = Date.now() - info.mtimeMs
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
  } catch {
    return -1
  }
}
