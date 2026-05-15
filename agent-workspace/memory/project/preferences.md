# Preferences

Stable user or project preferences that repeatedly affect how Fleet Pi work should be done.

## Implementation style

- Preference: Prefer small, focused, reviewable diffs over broad rewrites.
- Applies to: app code, Pi extensions, workspace memory, and documentation.
- Why it matters: Fleet Pi is both product code and an adaptive agent workspace, so uncontrolled churn makes future reasoning and review harder.
- Evidence: `agent-workspace/AGENTS.md` and repository validation conventions emphasize reading before editing, minimal diffs, and targeted validation.

## Workspace-first self-improvement

- Preference: Put durable agent learnings, plans, reports, eval evidence, and staged resources in `agent-workspace/` rather than hidden local state.
- Applies to: memory synthesis, self-improvement proposals, Pi resource management, and long-running roadmap work.
- Why it matters: The workspace is visible, versionable, and accessible to future agents.
- Evidence: The Pi alignment roadmap identifies `agent-workspace/` as the durable adaptive layer and `.pi/` as the compatibility bridge.

## Validation discipline

- Preference: Use `pnpm` from the repository root and choose the smallest relevant validation lane before broader checks.
- Applies to: TypeScript changes, Pi extension changes, UI changes, and workspace-contract changes.
- Why it matters: It keeps feedback fast while preserving confidence before handoff.
- Evidence: Root AGENTS guidance lists `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm knip`, and `pnpm validate-agents-md`.

## Approval boundary

- Preference: Autonomous self-improvement should primarily update memory, plans, reports, eval artifacts, and staged resources; app-code mutation, executable activation, and dependency changes should stay explicit and reviewable.
- Applies to: Harness mode, resource installation, and self-improvement loops.
- Why it matters: Fleet Pi should improve over time without silently changing product behavior or trust boundaries.
- Evidence: `agent-workspace/AGENTS.md` defines mutation tiers and mode boundaries.
