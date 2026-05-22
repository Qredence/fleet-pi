# Memory Recall — Autocontext Scenario Spec

This file documents the exact `autocontext_judge` and `autocontext_improve` invocations
for the memory-recall eval. It is the "wiring" between the eval rubric and the
Pi autocontext judging tools.

The rubric source is `agent-workspace/evals/memory-recall.md`.

---

## When to run

Run after:

- Any change to `.pi/extensions/lib/workspace-memory-index.ts`
- Any change to `.pi/extensions/workspace-context.ts`
- Any write to `agent-workspace/memory/project/*.md`

---

## How to judge a recorded output

Call `autocontext_judge` with the following parameters:

```
task_prompt: one of the test prompts from memory-recall.md
  e.g. "Where does Fleet Pi store its durable memory and plans?"

agent_output: the full text of the agent's response (copy from the chat turn)

rubric: |
  Score the response on four dimensions (each 0–1):

  1. Recall accuracy (weight 0.35)
     1.0 = correct answer with citation to memory file/snippet
     0.7 = correct but no citation
     0.4 = partially correct or conflated entries
     0.1 = wrong but agent hedged
     0.0 = confidently wrong

  2. Absence handling (weight 0.25)
     1.0 = inspected file before claiming absence
     0.6 = hedged without inspection
     0.2 = claimed absence without checking
     0.0 = invented answer

  3. Retrieval relevance (weight 0.25)
     1.0 = all top-3 injected snippets are topically relevant
     0.7 = 2 of 3 relevant
     0.4 = 1 of 3 relevant
     0.0 = no snippets relevant

  4. Source discipline (weight 0.15)
     1.0 = cites specific section + file
     0.6 = references "project memory" generically
     0.2 = no source but grounded answer
     0.0 = answer from model weights

  Compute: score = (dim1 × 0.35) + (dim2 × 0.25) + (dim3 × 0.25) + (dim4 × 0.15)
  Pass threshold: ≥ 0.75
```

---

## How to run an improvement loop

Call `autocontext_improve` with the same `task_prompt`, `initial_output`, and `rubric` above.
Set `quality_threshold: 0.75` and `max_rounds: 3`.

---

## Test prompt set (copy-paste ready)

**Recall prompts (should answer from memory):**

1. "Where does Fleet Pi store its durable memory and plans?"
2. "What is the difference between agent-workspace/ and .pi/?"
3. "What mode should I use to manage workspace architecture?"
4. "What is the session runtime TTL for Fleet Pi?"
5. "Why is the Neon Postgres mirror non-blocking?"

**Absence prompts (should inspect before answering):** 6. "What is Fleet Pi's WebSocket transport configuration?" 7. "What is the default compaction strategy?"

**Retrieval relevance prompts (check which snippets are injected):** 8. "How do I improve the chat streaming endpoint?" → expect: architecture, decisions 9. "What should I write to durable memory after a task?" → expect: preferences, decisions 10. "What is still unresolved in the Pi package lifecycle?" → expect: open-questions, known-issues

---

## Checking retrieval relevance (prompt 8–10)

To inspect which snippets were injected for a given turn:

1. Locate the Pi session JSONL file (`.fleet/sessions/<session-id>.jsonl`)
2. Find the entry with `customType: "workspace-context"`
3. Read the "Project memory recall snippets:" block
4. Compare the listed snippet keys against the expected dominant keys above

---

## Status

- Eval rubric: `agent-workspace/evals/memory-recall.md` ✓
- Scenario spec: this file ✓
- `autocontext_scenarios` registration: blocked by pi-autocontext module error
  (`Cannot find module './parsers/any.js'`) — use `autocontext_judge` directly
  until the package is updated
- Known issue: log in `known-issues.md` or `open-questions.md` when the package
  error is resolved so the scenario can be formally registered
