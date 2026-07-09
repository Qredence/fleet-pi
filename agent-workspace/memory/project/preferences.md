# Preferences

Stable user or project preferences that repeatedly affect how Fleet Pi work should be done.

## Implementation style

- Preference: Prefer small, focused, reviewable diffs over broad rewrites.
- Applies to: app code, Pi extensions, workspace memory, and documentation.
- Why it matters: Fleet Pi is both product code and an adaptive agent workspace, so uncontrolled churn makes future reasoning and review harder.
- Evidence: `agent-workspace/AGENTS.md` and repository validation conventions emphasize reading before editing, minimal diffs, and targeted validation.

## Read before editing

- Preference: Always read the relevant file before proposing or applying an edit. Never guess at content.
- Applies to: app code, Pi extensions, workspace files, and documentation.
- Why it matters: Files may have conventions, in-progress changes, or structural constraints that are only visible from the actual content. Editing without reading produces conflicting diffs.
- Evidence: `agent-workspace/AGENTS.md` operating constraints state "read before editing" as the first code quality rule.

## Clarify before acting with questionnaire

- Preference: Use `questionnaire` to surface intent, scope, or tradeoff choices before writing code or making irreversible changes.
- Applies to: any task with ambiguous scope, destructive operations, or decisions that affect multiple areas.
- Why it matters: Acting on misunderstood intent wastes effort and produces diffs that need immediate revert. A clarifying question costs less than a bad edit.
- Evidence: `agent-workspace/AGENTS.md` communication guidelines: "Surface uncertainty early. Use `questionnaire` to clarify before writing code."

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

## Design & UX Personalization

- Preference: Treat `@workspace/hax-design` as the sole UI source of truth; all reusable UI components, styling primitives, and Layout constants belong there. Do not create React components under `apps/web/src/components/`.
- Preference: Maintain a minimal floating pill-style header chrome. Avoid generic AI SaaS aesthetics (such as cream backgrounds, heavy IDE-style toolbars, card grids, or gradient heroes) unless explicitly requested.
- Preference: Use specific rounding tokens (`rounded-full` or `rounded-[100px]`) for header controls and InputBar selectors. Use `bg-sidebar` for inactive header pills and right-panel launcher buttons.
- Preference: Avoid inline `style` props; use Tailwind utilities, `cva`, or shared design tokens.
- Preference: Keep the chat column as a single full-width transcript and InputBar. Show artifact previews inside the right panel Artifacts tab rather than inside chat-transcript horizontal splits.
- Why it matters: Keeps Fleet Pi's design system consistent, clean, distinctive, and decoupled from the application logic.
- Evidence: `agent-workspace/AGENTS.md` (Design and User Preferences section).

## Testing & Directory Structure

- Preference: Put newly added test files inside a dedicated test directory for the module, such as `__tests__/` (e.g., `apps/web/src/lib/pi/__tests__/`), rather than scattering co-located test files.
- Why it matters: Keeps the codebase organized, clean, and easy to navigate for both human developers and agents.
- Evidence: Recent backend test organizational improvements on `feat/phase-2-decoupling`.
