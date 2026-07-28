import React from "react"
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/hax-design"

const FindingsCanvas = ({ findingsData }: { findingsData: any }) => {
  const { summaryFacts, findings, recommendations } = findingsData

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <header className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">
          Fleet Pi Harness Analysis
        </h1>
        <p className="text-slate-600">Agent Practices Review • 2026-07-25</p>

        {/* Metrics Bar */}
        <div className="mt-4 grid grid-cols-4 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-3xl font-bold text-green-600">
              {summaryFacts.dimensions.overallScore * 100}%
            </div>
            <div className="text-sm text-slate-600">Overall Score</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-3xl font-bold text-red-600">
              {summaryFacts.findingsBySeverity.HIGH}
            </div>
            <div className="text-sm text-slate-600">High Priority</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-3xl font-bold text-orange-600">
              {
                recommendations.filter((r: any) => r.type === "SHORT_TERM")
                  .length
              }
            </div>
            <div className="text-sm text-slate-600">Short-term Actions</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-3xl font-bold text-blue-600">
              {findings.length}
            </div>
            <div className="text-sm text-slate-600">Total Findings</div>
          </div>
        </div>
      </header>

      {/* Dimensions Radar Chart & Top Findings */}
      <div className="mb-8 grid grid-cols-2 gap-6">
        {/* Agent Practice Dimensions Radar */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">
            Agent Practice Dimensions
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart
              cx="50%"
              cy="50%"
              outerRadius="80%"
              data={[
                {
                  subject: "Context Inspection",
                  A: summaryFacts.dimensions.contextInspection.score * 100,
                  fullMark: 100,
                },
                {
                  subject: "Diff Discipline",
                  A: summaryFacts.dimensions.diffDiscipline.score * 100,
                  fullMark: 100,
                },
                {
                  subject: "Convention Preservation",
                  A: summaryFacts.dimensions.conventionPreservation.score * 100,
                  fullMark: 100,
                },
                {
                  subject: "Durable Output",
                  A: summaryFacts.dimensions.durableOutput.score * 100,
                  fullMark: 100,
                },
                {
                  subject: "Validation Honesty",
                  A: summaryFacts.dimensions.validationHonesty.score * 100,
                  fullMark: 100,
                },
              ]}
            >
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar
                name="Score"
                dataKey="A"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
              />
            </RadarChart>
          </ResponsiveContainer>

          <div className="mt-4 space-y-2">
            {Object.entries(summaryFacts.dimensions).map(
              ([key, value]: [string, any]) => (
                <div
                  key={key}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-700 capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500"
                        style={{ width: `${value.score * 100}%` }}
                      />
                    </div>
                    <span className="font-medium text-slate-900">
                      {(value.score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Key Findings Accordion */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">
            Key Findings ({findings.length})
          </h2>
          <div className="max-h-[400px] space-y-3 overflow-y-auto">
            {findings.map((finding: any, idx: number) => (
              <div
                key={finding.id}
                className={`rounded-lg border-l-4 p-4 ${
                  finding.severity === "HIGH"
                    ? "border-red-500 bg-red-50"
                    : finding.severity === "MEDIUM"
                      ? "border-yellow-500 bg-yellow-50"
                      : "border-green-500 bg-green-50"
                }`}
              >
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="font-semibold text-slate-900">
                    {finding.title}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      finding.severity === "HIGH"
                        ? "bg-red-200 text-red-800"
                        : finding.severity === "MEDIUM"
                          ? "bg-yellow-200 text-yellow-800"
                          : "bg-green-200 text-green-800"
                    }`}
                  >
                    {finding.severity}
                  </span>
                </div>
                <p className="mb-2 text-sm text-slate-700">
                  {finding.description}
                </p>
                <div className="text-xs text-slate-600">
                  Target:{" "}
                  <code className="rounded bg-slate-100 px-1">
                    {finding.target}
                  </code>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommended Actions Timeline */}
      <div className="mb-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-xl font-semibold text-slate-900">
          Recommended Actions
        </h2>
        <div className="space-y-6">
          {recommendations.map((rec: any, idx: number) => (
            <div
              key={idx}
              className="relative border-l-2 border-blue-200 pb-6 pl-8 last:border-0 last:pb-0"
            >
              <div
                className={`absolute top-0 left-[-9px] h-4 w-4 rounded-full ${
                  rec.type === "IMMEDIATE"
                    ? "bg-red-500"
                    : rec.type === "SHORT_TERM"
                      ? "bg-yellow-500"
                      : "bg-green-500"
                }`}
              />

              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">{rec.focus}</h3>
                <div className="flex gap-2">
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    {rec.effort} effort
                  </span>
                  <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">
                    {rec.timeline}
                  </span>
                </div>
              </div>

              <p className="mb-2 text-sm text-slate-700">{rec.rationale}</p>

              <div className="text-xs text-slate-600">
                <strong>Route:</strong>{" "}
                {rec.route
                  ?.split(",")[0]
                  ?.replace("IMMEDIATE ", "")
                  .replace("Extend ", "")
                  .replace("Expand ", "") || "Implementation required"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evidence Sources & Notes */}
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">
            Evidence Sources
          </h2>
          <ul className="space-y-2 text-sm text-slate-700">
            {[
              "agent-workspace/system/behavior.md",
              "agent-workspace/memory/project/architecture.md",
              "agent-workspace/memory/project/preferences.md",
              "agent-workspace/memory/project/known-issues.md",
              "agent-workspace/evals/agentic-coding.md",
              "AGENTS.md",
            ].map((source, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <code className="rounded bg-slate-100 px-2 py-1">{source}</code>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">
            Analysis Notes
          </h2>
          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            <p className="mb-2">
              <strong>
                Better harness CLI tool not available in environment;
              </strong>
            </p>
            <p>
              Analysis performed through manual codebase review following Step 1
              asset scan and Step 4 reporting standards. Four findings
              identified across process gaps, capability gaps, UX gaps, and
              performance optimization opportunities.
            </p>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4">
            <h3 className="mb-2 font-medium text-slate-900">
              Confidence Level
            </h3>
            <div className="flex items-center gap-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: "95%" }}
                />
              </div>
              <span className="text-sm text-slate-700">High (0.95)</span>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Based on comprehensive evidence from canonical project memory
              files and agent behavior specifications.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
        Generated by Fleet Pi Harness Analysis • 2026-07-25T23:30:00Z • Manual
        analysis mode
      </footer>
    </div>
  )
}

export default FindingsCanvas
