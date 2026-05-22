# Memory Recall Eval

Rubric for evaluating Fleet Pi's ability to answer questions from canonical project memory
and to surface relevant snippets for a given prompt.

Use this with `pi-autocontext` by registering it as a scenario and running
`autocontext_judge` or `autocontext_improve` against a recorded agent output.

---

## Scenario Description

Fleet Pi's startup context injects project memory snippets from
`agent-workspace/memory/project/*.md`. This eval tests whether:

1. The agent can answer project-knowledge questions from memory without reading files.
2. Prompt-aware retrieval surfaces more relevant snippets than the static baseline.
3. The agent routes to file inspection (not guessing) when memory is genuinely absent.

---

## Dimensions (each scored 0–1)

### 1. Recall accuracy (weight: 0.35)

Does the agent answer project-knowledge questions correctly using injected memory?

| Score | Meaning                                                         |
| ----- | --------------------------------------------------------------- |
| 1.0   | Answer is correct and cites the relevant memory file or snippet |
| 0.7   | Answer is correct but no citation or vague attribution          |
| 0.4   | Answer is partially correct or conflates two memory entries     |
| 0.1   | Answer is wrong but agent hedges appropriately                  |
| 0.0   | Answer is confidently wrong                                     |

**Test prompts:**

- "Where does Fleet Pi store its durable memory and plans?"
- "What is the difference between agent-workspace/ and .pi/?"
- "What mode should I use to manage workspace architecture?"
- "What is the session runtime TTL for Fleet Pi?"
- "Why is the Neon Postgres mirror non-blocking?"

### 2. Absence handling (weight: 0.25)

Does the agent correctly distinguish between "I don't recall" and
"file inspection reveals it's absent"?

| Score | Meaning                                                            |
| ----- | ------------------------------------------------------------------ |
| 1.0   | Uses find/grep or reads the canonical file before claiming absence |
| 0.6   | Hedges appropriately ("I don't have this in recall; let me check") |
| 0.2   | Claims absence without inspection                                  |
| 0.0   | Invents a plausible-sounding answer                                |

**Test prompts:**

- "What is Fleet Pi's WebSocket transport configuration?" (not in memory)
- "What is the default compaction strategy?" (not in memory)

### 3. Retrieval relevance (weight: 0.25)

Are the injected snippets relevant to the current prompt? (Evaluates the
prompt-aware retrieval implemented in `workspace-memory-index.ts`.)

| Score | Meaning                                                           |
| ----- | ----------------------------------------------------------------- |
| 1.0   | All top-3 injected snippets are topically relevant to the prompt  |
| 0.7   | At least 2 of top-3 snippets are relevant                         |
| 0.4   | Only 1 snippet is relevant; others are unrelated                  |
| 0.0   | No snippets are relevant; static baseline would have done as well |

**How to measure:** Inspect the `[WORKSPACE CONTEXT]` block in the Pi session
JSONL for the `workspace-context` custom message. Compare which snippets appear
against what the prompt was asking about.

**Test prompts (pair each with expected dominant memory key):**

- "How do I improve the chat streaming endpoint?" → expected: `architecture`, `decisions`
- "What should I write to durable memory after a task?" → expected: `preferences`, `decisions`
- "What is still unresolved in the Pi package lifecycle?" → expected: `open-questions`, `known-issues`

### 4. Source discipline (weight: 0.15)

Does the agent read the right canonical file and cite it, rather than
reconstructing facts from general knowledge?

| Score | Meaning                                                                                 |
| ----- | --------------------------------------------------------------------------------------- |
| 1.0   | Cites specific section and file (e.g. "decisions.md — Mode boundaries govern autonomy") |
| 0.6   | References "project memory" generically but correctly                                   |
| 0.2   | Cites no source but answer is grounded                                                  |
| 0.0   | Answer sourced from model weights, not memory files                                     |

---

## Overall pass threshold

**Pass:** weighted average ≥ 0.75

```
score = (recall_accuracy × 0.35) + (absence_handling × 0.25)
      + (retrieval_relevance × 0.25) + (source_discipline × 0.15)
```

---

## Regression triggers

Re-run this eval after any of the following changes:

- Edits to `.pi/extensions/lib/workspace-memory-index.ts`
- Edits to `.pi/extensions/workspace-context.ts`
- Additions or rewrites to any `agent-workspace/memory/project/*.md` file
- Changes to startup context injection logic in `before_agent_start`

---

## Autocontext scenario registration (Step 6)

Register a scenario named `memory-recall` that:

- Uses the test prompts above as the `task_prompt`
- Targets a Fleet Pi agent session output that includes the workspace context block
- Scores against this rubric via `autocontext_judge`

See `agent-workspace/plans/active/memory-recall-improvement.md` for the
full wiring plan.
