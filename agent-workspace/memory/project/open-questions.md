# Open Questions

Unresolved questions that affect Fleet Pi’s Pi-native memory, reasoning, and self-improvement design.

## Memory package strategy

- Question: Should Fleet Pi build its own workspace-native memory lifecycle first, adopt a third-party Pi memory package, or combine both behind clear source-of-truth boundaries?
- Why it matters: The Pi package catalog includes persistent memory packages, but Fleet Pi already has a reviewable `agent-workspace/memory/project/*` contract.
- Current evidence: `@samfp/pi-memory` and `pi-hermes-memory` are available in the Pi package catalog; Fleet Pi currently indexes canonical Markdown memory through `.pi/extensions/lib/workspace-memory-index.ts`.
- Next step: Compare package behavior against Fleet Pi’s requirement that durable canonical memory stay in `agent-workspace/`.

## Recall relevance

- Question: How should Fleet Pi select task-relevant memory snippets without over-injecting all project memory into every turn?
- Why it matters: Startup context needs enough continuity to help reasoning, but excessive memory can waste tokens or bias unrelated tasks.
- Current evidence: Startup context now has compact canonical snippets, but no semantic or prompt-aware retrieval.
- Next step: Add prompt-aware or search-index-backed recall after the canonical memory model proves useful.

## Eval runner

- Question: Should Fleet Pi use `pi-autocontext`, `pi-autoresearch`, a custom Fleet Pi extension, or an external evaluator for repeatable self-improvement scoring?
- Why it matters: A self-improvement loop needs evidence that changes improve memory recall, mode boundaries, and tool use.
- Current evidence: Eval checklist files exist in `agent-workspace/evals/`, and Pi packages for judging/experiments are installed.
- Next step: Define one executable memory-recall or mode-boundary eval before expanding the runner.

## Package activation policy

- Question: Should project-local npm/git Pi packages ever be auto-activated, or should executable activation always require explicit user approval?
- Why it matters: Package activation can introduce executable code into the Pi runtime.
- Current evidence: `resource_install` stages executable extensions/packages unless activation is explicitly requested.
- Next step: Keep staged-by-default behavior until a package trust model exists.
