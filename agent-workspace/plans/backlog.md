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
- Inputs: `.pi/extensions/resource-install.ts`, `.pi/extensions/lib/resource-install.ts`, `apps/web/src/lib/pi/runtime/model-catalog.ts`, Resources panel.
- Next step: Design a package trust/activation policy before adding install/update commands.

## Candidate plan: reasoning controls UI

- Goal: Surface thinking budgets, branch summaries, and reasoning presets by mode/task as first-class UI controls.
- Why now: Mode/task-specific reasoning requires code/config changes today; users cannot tune it from the Configurations panel.
- Inputs: `.pi/settings.json` schema, `apps/web/src/routes/index.tsx` Configurations tab, `apps/web/src/lib/pi/server-runtime.ts`.
- Next step: Add thinking budget and reasoning preset fields to the settings schema, then surface them in the Configurations panel.

## Candidate plan: section-level memory scoring

- Goal: Weight memory snippets by which section heading they fall under, so facts under the most relevant heading rank higher in recall.
- Why now: Prompt-aware recall currently scores bullets globally without section context. A fact about "chat streaming" under a section titled "Architecture" should rank differently than the same fact under "Known Issues".
- Inputs: `.pi/extensions/lib/workspace-memory-index.ts` `selectScoredSnippets` function.
- Next step: Add section-tracking during bullet extraction; weight by section-title term overlap with the prompt.

## Candidate plan: configurable recall limit

- Goal: Make `selectScoredSnippets` `limit` parameter configurable via `.pi/settings.json` instead of hardcoded at 10.
- Why now: Different tasks benefit from different snippet densities. Reading a memory file asks for more context; answering a specific question needs fewer, more targeted snippets.
- Inputs: `.pi/settings.json` schema, `.pi/extensions/lib/workspace-memory-index.ts`.
- Next step: Add `"memoryRecallSnippetLimit"` key to settings schema; wire into `selectScoredSnippets` call.

## Candidate plan: regression gate for memory-recall eval

- Goal: Run `memory-recall` autocontext eval automatically after workspace-context or memory-index changes.
- Why now: Edits to `.pi/extensions/lib/workspace-memory-index.ts` or `.pi/extensions/workspace-context.ts` can silently regress recall quality.
- Inputs: `agent-workspace/evals/memory-recall.md`, CI/gate pipeline.
- Next step: Add a regression-gate script that invokes `autocontext_judge` against the memory-recall scenario and checks the score is ≥0.75.

---

## Promoted to active

- ~~Candidate plan: prompt-aware memory recall~~ → promoted to `plans/active/memory-recall-improvement.md` (2026-05-22, completed 2026-07-17)
- ~~Candidate plan: memory recall eval~~ → merged into memory-recall-improvement.md
