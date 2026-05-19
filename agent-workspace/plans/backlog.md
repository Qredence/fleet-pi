# Plan Backlog

Durable candidate plans for Fleet Pi self-improvement and Pi-native alignment.

## Candidate plan: prompt-aware memory recall

- Goal: Retrieve and inject task-relevant project memory snippets instead of only a fixed compact startup summary.
- Why now: Canonical memory is now populated and startup context can include snippets, but recall is not yet prompt-aware.
- Inputs: `agent-workspace/memory/project/*`, `.pi/extensions/lib/workspace-memory-index.ts`, `.pi/extensions/workspace-context.ts`, workspace search/index APIs.
- Next step: Add a retrieval function that ranks memory snippets by prompt terms or workspace index search results, then test fallback behavior.

## Candidate plan: self-improvement candidate extraction

- Goal: Convert repeated tool failures, validation failures, user corrections, and resource diagnostics into backlog candidates.
- Why now: Fleet Pi has run provenance, eval checklists, Autocontext packages, and workspace tools, but no closed observe → judge → propose loop.
- Inputs: run provenance records, Pi session entries, `agent-workspace/evals/*`, `agent-workspace/memory/project/known-issues.md`.
- Next step: Define a small candidate schema and write generated proposals to this backlog or `agent-workspace/artifacts/reports/`.

## Candidate plan: memory recall eval

- Goal: Add a repeatable eval that checks whether Fleet Pi can answer questions from canonical project memory and route missing facts to search before claiming absence.
- Why now: Startup context now exposes recall snippets, so regressions should be measurable.
- Inputs: `agent-workspace/evals/memory-quality.md`, `apps/web/src/lib/pi/workspace-memory-index.spec.ts`, canonical memory files.
- Next step: Add a `memory-recall.md` eval rubric and a targeted test fixture for recall-context formatting.

## Candidate plan: Pi package lifecycle management

- Goal: Extend resource management toward Pi package lifecycle parity: npm/git specs, pinning, updates, package filters, trust metadata, and activation state.
- Why now: The package catalog has useful memory/orchestration packages, but `resource_install` currently covers a narrower local-resource flow.
- Inputs: `.pi/extensions/resource-install.ts`, `.pi/extensions/lib/resource-install.ts`, `apps/web/src/lib/pi/server-catalog.ts`, Resources panel.
- Next step: Design a package trust/activation policy before adding install/update commands.
