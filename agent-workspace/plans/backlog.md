# Plan Backlog

Durable candidate plans for Fleet Pi self-improvement and Pi-native alignment.

## Candidate plan: self-improvement candidate extraction

- Goal: Convert repeated tool failures, validation failures, user corrections, and resource diagnostics into backlog candidates.
- Why now: Fleet Pi has run provenance, eval checklists, Autocontext packages, and workspace tools, but no closed observe → judge → propose loop.
- Inputs: run provenance records, Pi session entries, `agent-workspace/evals/*`, `agent-workspace/memory/project/known-issues.md`.
- Next step: Define a small candidate schema and write generated proposals to this backlog or `agent-workspace/artifacts/reports/`.

## Candidate plan: Pi package lifecycle management

- Goal: Extend resource management toward Pi package lifecycle parity: npm/git specs, pinning, updates, package filters, trust metadata, and activation state.
- Why now: The package catalog has useful memory/orchestration packages, but `resource_install` currently covers a narrower local-resource flow.
- Inputs: `.pi/extensions/resource-install.ts`, `.pi/extensions/lib/resource-install.ts`, `apps/web/src/lib/pi/server-catalog.ts`, Resources panel.
- Next step: Design a package trust/activation policy before adding install/update commands.

## Candidate plan: reasoning controls UI

- Goal: Surface thinking budgets, branch summaries, and reasoning presets by mode/task as first-class UI controls.
- Why now: Mode/task-specific reasoning requires code/config changes today; users cannot tune it from the Configurations panel.
- Inputs: `.pi/settings.json` schema, `apps/web/src/routes/index.tsx` Configurations tab, `apps/web/src/lib/pi/server-runtime.ts`.
- Next step: Add thinking budget and reasoning preset fields to the settings schema, then surface them in the Configurations panel.

---

## Promoted to active

- ~~Candidate plan: prompt-aware memory recall~~ → promoted to `plans/active/memory-recall-improvement.md` (2026-05-22, completed)
- ~~Candidate plan: memory recall eval~~ → merged into memory-recall-improvement.md
