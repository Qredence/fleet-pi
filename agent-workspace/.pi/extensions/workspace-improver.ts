import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { Type } from "typebox"
import { StringEnum } from "@earendil-works/pi-ai"
import {
  analyzeWorkspace,
  type FindingCategory,
  type FindingSeverity,
} from "./lib/workspace-improver"

const CATEGORIES: Array<FindingCategory> = [
  "canonical-memory",
  "plan-hygiene",
  "skill-integrity",
  "crossref-integrity",
  "boundary-compliance",
  "self-improvement-loop",
  "staleness",
  "orphaned-files",
]

function formatReport(
  report: Awaited<ReturnType<typeof analyzeWorkspace>>
): string {
  const { summary, findings, workspaceStats } = report
  const lines: Array<string> = []

  lines.push("# Workspace Improvement Report")
  lines.push("")
  lines.push(
    `Scanned ${workspaceStats.totalFiles} files across ${workspaceStats.totalDirs} directories.`
  )
  lines.push("")
  lines.push("## Summary")
  lines.push("")
  lines.push(`| Metric | Value |`)
  lines.push(`| ------ | ----- |`)
  lines.push(`| Total findings | ${summary.totalFindings} |`)
  lines.push(`| Critical | ${summary.bySeverity.critical} |`)
  lines.push(`| Warning | ${summary.bySeverity.warning} |`)
  lines.push(`| Info | ${summary.bySeverity.info} |`)
  lines.push("")
  lines.push("## Workspace Statistics")
  lines.push("")
  lines.push(`| Stat | Value |`)
  lines.push(`| ---- | ----- |`)
  lines.push(`| Total files | ${workspaceStats.totalFiles} |`)
  lines.push(`| Total directories | ${workspaceStats.totalDirs} |`)
  lines.push(
    `| Canonical memory files | ${workspaceStats.canonicalMemoryFiles}/5 |`
  )
  lines.push(
    `| Orphaned memory files | ${workspaceStats.orphanedMemoryFiles} |`
  )
  lines.push(`| Active plans | ${workspaceStats.activePlans} |`)
  lines.push(`| Completed plans | ${workspaceStats.completedPlans} |`)
  lines.push(`| Workspace skills | ${workspaceStats.skills} |`)
  lines.push(`| Eval files | ${workspaceStats.evals} |`)
  lines.push("")

  if (findings.length === 0) {
    lines.push("✅ No issues found — the workspace is in good shape!")
    return lines.join("\n")
  }

  // Group findings by severity for display
  const categorized = findings.reduce<
    Record<FindingSeverity, Array<(typeof findings)[number]>>
  >(
    (acc, f) => {
      acc[f.severity].push(f)
      return acc
    },
    { critical: [], warning: [], info: [] }
  )

  for (const severity of ["critical", "warning", "info"] as const) {
    const items = categorized[severity]
    if (items.length === 0) continue

    const emoji =
      severity === "critical" ? "🔴" : severity === "warning" ? "🟡" : "ℹ️"
    lines.push(
      `## ${emoji} ${severity.charAt(0).toUpperCase() + severity.slice(1)} Findings (${items.length})`
    )
    lines.push("")

    // Group by category within severity
    const byCat = items.reduce<
      Record<string, Array<(typeof findings)[number]>>
    >((acc, f) => {
      const cat = f.category
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(f)
      return acc
    }, {})

    for (const [cat, catFindings] of Object.entries(byCat)) {
      lines.push(`### ${cat}`)

      for (const f of catFindings) {
        lines.push("")
        lines.push(`**${f.title}**`)
        if (f.target) {
          lines.push(`- **Target:** \`${f.target}\``)
        }
        lines.push(`- ${f.description}`)
        lines.push(`- **Suggestion:** ${f.suggestion}`)
      }
      lines.push("")
    }
  }

  return lines.join("\n")
}

export default function workspaceImproverExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "workspace_improver",
    label: "Workspace Improver",
    description:
      "Analyze agent-workspace/ and surface actionable self-improvement suggestions. " +
      "Scans canonical memory, plans, skills, cross-references, boundary compliance, " +
      "the self-improvement loop pipeline, staleness, and orphaned files. " +
      "Returns a structured report with findings grouped by severity (critical, warning, info). " +
      "Use this periodically to close the self-improvement loop and identify gaps.",
    promptSnippet:
      "audit and improve the workspace: use workspace_improver to scan agent-workspace/ for gaps, staleness, and self-improvement opportunities",
    promptGuidelines: [
      "Use workspace_improver when you need to assess workspace health, find stale plans, check memory completeness, or identify self-improvement candidates.",
      "Use workspace_improver with filterCategories to focus on a specific area like canonical-memory, plan-hygiene, or self-improvement-loop.",
      "After getting a workspace improvement report, use workspace_write (with rationale) to apply the suggested fixes — one finding at a time.",
    ],
    parameters: Type.Object({
      filterCategories: Type.Optional(
        Type.Array(StringEnum(CATEGORIES as unknown as [string, ...string[]]), {
          description:
            "Optional: only analyze these categories. Omit to scan everything.",
        })
      ),
      minSeverity: Type.Optional(
        StringEnum(["critical", "warning", "info"] as [string, ...string[]], {
          description:
            "Optional: minimum severity to include. 'critical' = only critical, 'warning' = critical + warning, 'info' = all (default).",
        })
      ),
      format: Type.Optional(
        StringEnum(["text", "json"] as [string, ...string[]], {
          description:
            "Output format. 'text' (default) returns a formatted Markdown report. 'json' returns the structured data object for programmatic use.",
        })
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.sessionManager.getCwd()

      const report = await analyzeWorkspace(cwd, {
        filterCategories: params.filterCategories as
          Array<FindingCategory> | undefined,
        minSeverity: params.minSeverity as FindingSeverity | undefined,
      })

      if (params.format === "json") {
        return {
          content: [
            {
              type: "text",
              text: `Workspace improvement report: ${report.summary.totalFindings} findings (${report.summary.bySeverity.critical} critical, ${report.summary.bySeverity.warning} warning, ${report.summary.bySeverity.info} info)`,
            },
          ],
          details: report,
        }
      }

      const formatted = formatReport(report)

      return {
        content: [
          {
            type: "text",
            text: [
              `Workspace improvement report — ${report.summary.totalFindings} findings (${report.summary.bySeverity.critical}🔴 / ${report.summary.bySeverity.warning}🟡 / ${report.summary.bySeverity.info}ℹ️)`,
              "",
              "```",
              ...formatted.split("\n"),
              "```",
            ].join("\n"),
          },
        ],
        details: report,
      }
    },
  })
}
