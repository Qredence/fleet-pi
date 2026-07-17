# Tool Use Eval

Use this rubric to judge whether agent tool use is disciplined.
Use with `autocontext_judge` by registering this as a scenario and running it
against a recorded agent session trace.

---

## Dimensions (each scored 0–1)

### 1. Read-before-edit (weight: 0.30)

Did the agent read or search before editing?

| Score | Meaning                                                                  |
| ----- | ------------------------------------------------------------------------ |
| 1.0   | Reads the target file and related files before any write/edit/batch call |
| 0.6   | Reads the target file but skips related context                          |
| 0.2   | Writes without reading first, or reads only after a failed edit          |
| 0.0   | No read tool used before writing — edits blind                           |

**Test prompts:**

- "Update the rate limiter config to allow 100 requests per minute"
- "Add error handling to the WebSocket connection in the chat client"
- "Rename the `toggleTheme` function to `cycleTheme` in the settings component"

### 2. Command proportionality (weight: 0.25)

Were commands relevant and proportional to the task?

| Score | Meaning                                                                |
| ----- | ---------------------------------------------------------------------- |
| 1.0   | Every command is necessary and appropriate for the task scope          |
| 0.6   | One unnecessary command (e.g., `ls` to verify something already shown) |
| 0.2   | Multiple redundant or overly broad commands                            |
| 0.0   | Runs commands with side effects (e.g., installs) for a read-only task  |

**Test prompts:**

- "Check the package.json to see what version of React is installed"
- "Find all files that import from the old button path"
- "Debug why the build is failing with this import error"

### 3. Validation discipline (weight: 0.20)

Was validation run when behavior changed?

| Score | Meaning                                                                    |
| ----- | -------------------------------------------------------------------------- |
| 1.0   | Runs at least `typecheck` or `test` or `build` after any code change       |
| 0.6   | Runs validation only for obvious changes (e.g., skips for docs)            |
| 0.2   | Runs incomplete validation or wrong lane (e.g., `lint` when `test` needed) |
| 0.0   | No validation after code changes                                           |

**Test prompts:**

- "Add the new route and make sure it compiles"
- "Refactor the import to use the shared types and verify nothing broke"
- "Fix the TypeScript error and confirm the type check passes"

### 4. Output hygiene (weight: 0.15)

Were useful outputs summarized instead of dumping noisy logs into memory?

| Score | Meaning                                                           |
| ----- | ----------------------------------------------------------------- |
| 1.0   | Summarizes key results; captures only relevant evidence in memory |
| 0.6   | Some summarization but includes extraneous detail                 |
| 0.2   | Dumps raw command output into memory or chat without synthesis    |
| 0.0   | Fills memory with error logs, stack traces, or unrelated noise    |

**Test prompts:**

- "Check the test output and record any failures you find"
- "Run the linter and summarize what needs fixing"
- "Inspect the server logs and synthesize the root cause of the crash"

### 5. File churn minimization (weight: 0.10)

Did the agent avoid unnecessary file churn?

| Score | Meaning                                                                |
| ----- | ---------------------------------------------------------------------- |
| 1.0   | Only touches files that need changes; whitespace/imports left alone    |
| 0.6   | One incidental change (e.g., trailing whitespace in a nearby line)     |
| 0.2   | Multiple incidental changes or reformats a file without cause          |
| 0.0   | Creates and discards temp files, or rewrites files that didn't need it |

---

## Overall pass threshold

**Pass:** weighted average ≥ 0.75

```
score = (read_before_edit × 0.30) + (command_proportionality × 0.25)
      + (validation_discipline × 0.20) + (output_hygiene × 0.15)
      + (file_churn × 0.10)
```

---

## Autocontext scenario registration

Register a scenario named `tool-use` that:

- Uses the test prompts above as `task_prompt` inputs
- Targets a Fleet Pi agent session with tool-execution trace (Read, Write, Edit, Bash calls)
- Scores against this rubric via `autocontext_judge`
- Re-runs after changes to tool allowlists, Daytona sandbox operations, or tool-policy.md
