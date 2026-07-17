# Memory Quality Eval

Use this checklist to judge whether workspace memory is useful and trustworthy.
Use with `autocontext_judge` by registering this as a scenario and running it
against a recorded agent output (e.g., a `workspace_write` or memory synthesis
session).

---

## Dimensions (each scored 0–1)

### 1. Durability (weight: 0.30)

Is the note durable rather than session-noisy?

| Score | Meaning                                                                |
| ----- | ---------------------------------------------------------------------- |
| 1.0   | Records a stable fact, decision, or pattern that benefits future turns |
| 0.6   | Useful but slightly tied to a specific session context                 |
| 0.2   | Session-specific or ephemeral detail                                   |
| 0.0   | Noise — chat log dump or already-known meta-information                |

**Test prompts:**

- "Record what you learned about the API key format for the BYOK provider"
- "Note the database migration ordering constraint you discovered"
- "Synthesize the key facts from our conversation about session management"

### 2. Evidence grounding (weight: 0.25)

Is the entry grounded in repository evidence, not guesswork?

| Score | Meaning                                                      |
| ----- | ------------------------------------------------------------ |
| 1.0   | Cites specific files, lines, or commands that back the claim |
| 0.6   | Grounded but vague about exact source location               |
| 0.2   | Plausible but no source evidence provided                    |
| 0.0   | Fabricated or not supported by the repo                      |

**Test prompts:**

- "Check the workspace-memory-index.ts — record how snippet extraction works"
- "Read the known-issues file and synthesize a new entry about the bug we discussed"
- "Look at the settings schema and note which fields support hot-reload"

### 3. Scope discipline (weight: 0.20)

Is the scope narrow enough to stay maintainable?

| Score | Meaning                                                        |
| ----- | -------------------------------------------------------------- |
| 1.0   | Covers one coherent topic; will make sense to a future agent   |
| 0.6   | Addresses one topic but includes tangents                      |
| 0.2   | Tries to cover too much; multiple unrelated facts in one entry |
| 0.0   | Records everything indiscriminately (dump, not synthesis)      |

**Test prompts:**

- "Summarize only the provider configuration details from our discussion"
- "Record the routing convention, separate from the component style notes"
- "Write a concise entry about the change from static to prompt-aware recall"

### 4. Repository navigation (weight: 0.15)

Does the entry point to the right place in the repo or workspace?

| Score | Meaning                                                            |
| ----- | ------------------------------------------------------------------ |
| 1.0   | Includes a clear file path or `target` field for the relevant area |
| 0.6   | Implies the location but doesn't state it                          |
| 0.2   | Location is guessable but not stated                               |
| 0.0   | No indication of where this knowledge applies                      |

**Test prompts:**

- "Note where the chat streaming endpoint lives for future reference"
- "Document which file contains the autocontext judging logic"
- "Update the architecture entry with the path to the new memory-index code"

### 5. Trustworthiness (weight: 0.10)

Would a future agent know when to trust or revisit it?

| Score | Meaning                                                             |
| ----- | ------------------------------------------------------------------- |
| 1.0   | Includes status (Active/Resolved/Outdated) and when it was recorded |
| 0.6   | Includes status but no date                                         |
| 0.2   | No status — agent can't tell if it's still current                  |
| 0.0   | Misleading — implies authority for something that changed           |

---

## Overall pass threshold

**Pass:** weighted average ≥ 0.75

```
score = (durability × 0.30) + (evidence_grounding × 0.25)
      + (scope_discipline × 0.20) + (navigation × 0.15)
      + (trustworthiness × 0.10)
```

---

## Autocontext scenario registration

Register a scenario named `memory-quality` that:

- Uses the test prompts above as `task_prompt` inputs
- Targets a Fleet Pi agent session where `workspace_write` was used to create or update memory
- Scores against this rubric via `autocontext_judge`
- Re-runs after changes to memory-index logic, workspace-write extension, or memory synthesis skills
