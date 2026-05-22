# Open Questions

Unresolved questions that affect Fleet Pi's Pi-native memory, reasoning, and self-improvement design.

## Memory package strategy

- Question: Should Fleet Pi build its own workspace-native memory lifecycle first, adopt a third-party Pi memory package, or combine both behind clear source-of-truth boundaries?
- Why it matters: The Pi package catalog includes persistent memory packages, but Fleet Pi already has a reviewable `agent-workspace/memory/project/*` contract.
- Current evidence: `@samfp/pi-memory` and `pi-hermes-memory` are available in the Pi package catalog; Fleet Pi currently indexes canonical Markdown memory through `.pi/extensions/lib/workspace-memory-index.ts`.
- Next step: Compare package behavior against Fleet Pi's requirement that durable canonical memory stay in `agent-workspace/`.

## Recall relevance

- Question: How should Fleet Pi select task-relevant memory snippets without over-injecting all project memory into every turn?
- Why it matters: Startup context needs enough continuity to help reasoning, but excessive memory can waste tokens or bias unrelated tasks.
- Current evidence: Snippet extraction is static (first 4 bullet items per file, 3 surfaced per turn = max 15 fixed snippets). A prompt-aware retrieval plan using `workspace_index` search is now actively being implemented.
- Next step: Complete the retrieval implementation in `.pi/extensions/lib/workspace-memory-index.ts` and validate with a memory-recall eval scenario in `pi-autocontext`.

## Eval runner — scenario design

- Question: What should the first executable memory-recall scenario look like: what questions, what rubric dimensions, and what pass threshold?
- Why it matters: Running the eval is now unblocked (pi-autocontext chosen), but the scenario specification is still missing.
- Current evidence: `agent-workspace/evals/memory-quality.md` exists as a checklist; `pi-autocontext` judging is installed. A `memory-recall.md` rubric file is planned as part of the active improvement plan.
- Next step: Write `agent-workspace/evals/memory-recall.md` with scored questions (3–5 dimensions, 0–1 scale) and register a matching autocontext scenario.

## Package activation policy

- Question: Should project-local npm/git Pi packages ever be auto-activated, or should executable activation always require explicit user approval?
- Why it matters: Package activation can introduce executable code into the Pi runtime.
- Current evidence: `resource_install` stages executable extensions/packages unless activation is explicitly requested.
- Next step: Keep staged-by-default behavior until a package trust model exists.
