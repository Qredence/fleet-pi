# Open Questions

Unresolved questions that affect Fleet Pi's Pi-native memory, reasoning, and self-improvement design.

## Memory package strategy

- Question: Should Fleet Pi build its own workspace-native memory lifecycle first, adopt a third-party Pi memory package, or combine both behind clear source-of-truth boundaries?
- Why it matters: The Pi package catalog includes persistent memory packages, but Fleet Pi already has a reviewable `agent-workspace/memory/project/*` contract.
- Current evidence: `@samfp/pi-memory` and `pi-hermes-memory` are available in the Pi package catalog; Fleet Pi currently indexes canonical Markdown memory through `.pi/extensions/lib/workspace-memory-index.ts`.
- Next step: Compare package behavior against Fleet Pi's requirement that durable canonical memory stay in `agent-workspace/`.

## Package activation policy

- Question: Should project-local npm/git Pi packages ever be auto-activated, or should executable activation always require explicit user approval?
- Why it matters: Package activation can introduce executable code into the Pi runtime.
- Current evidence: `resource_install` stages executable extensions/packages unless activation is explicitly requested.
- Next step: Keep staged-by-default behavior until a package trust model exists.

## Daytona Sandbox lifecycle & resource persistence

- Question: How should user-scoped Daytona sandbox volumes persist workspace changes across auto-stop intervals and session restarts, and how can we minimize sandbox provisioning/start latency?
- Why it matters: High startup latency directly degrades the chat experience, while losing workspace edits when sandboxes auto-stop breaks developers' workflow.
- Current evidence: We use `getUserSandbox` with `daytona` SDK, and support autoStopInterval configuration.
- Next step: Investigate pre-provisioning strategies, snapshot reuse, and volume mount optimization.

## Neon Postgres RLS & mirror resilience under load

- Question: What are the performance implications of Row Level Security (RLS) policies for high-volume concurrent chat sessions, and what is the optimal connection/pooling strategy?
- Why it matters: If the database mirror experiences connection spikes or latency, it must remain fully non-blocking and robust, ensuring zero degradation of chat-stream delivery.
- Current evidence: RLS on `pi_sessions` uses transaction-scoped `app.current_user_id`. Mirror failures are successfully caught and logged without affecting streams.
- Next step: Load-test session mirroring with high-concurrency connections and optimize transaction-scoped config switches.

# Resolved Questions

## Recall relevance (Resolved)

- Question: How should Fleet Pi select task-relevant memory snippets without over-injecting all project memory into every turn?
- Resolution: **Resolved and Active.** We implemented prompt-aware dynamic keyword-based context retrieval.
- How it works: `.pi/extensions/lib/workspace-memory-index.ts` extracts all canonical bullet snippets, tokenizes the latest user prompt, filters stop words, scores snippets globally by prompt-term overlap, and rewrites the retained `workspace-context` message with the top-10 matches plus deterministic fallback snippets when needed.
- Source: `.pi/extensions/lib/workspace-memory-index.ts`, `.pi/extensions/workspace-context.ts`.

## Eval runner — scenario design (Resolved)

- Question: What should the first executable memory-recall scenario look like: what questions, what rubric dimensions, and what pass threshold?
- Resolution: **Resolved.** We designed and wrote the `agent-workspace/evals/memory-recall.md` rubric.
- How it works: Defines a 4-dimension scoring system (Recall accuracy, Absence handling, Retrieval relevance, Source discipline) with a pass threshold of 0.75, backed by manual and autocontext-judge validation test cases.
- Source: `agent-workspace/evals/memory-recall.md`, `agent-workspace/artifacts/reports/memory-recall-scenario-spec.md`.
