# Regression Check Eval

Use this rubric to judge whether changes were validated at the right level.
Use with `autocontext_judge` by registering this as a scenario and running it
against a recorded agent session that performed code changes or workspace mutations.

---

## Dimensions (each scored 0–1)

### 1. Validation lane selection (weight: 0.30)

Was the smallest relevant validation lane chosen?

| Score | Meaning                                                                   |
| ----- | ------------------------------------------------------------------------- |
| 1.0   | Runs the narrowest valid check (`pnpm test --filter pkg` over full suite) |
| 0.6   | Runs a reasonable check but broader than needed                           |
| 0.2   | Runs the wrong check (e.g., `build` when `typecheck` would suffice)       |
| 0.0   | Runs no validation or the maximum scope every time                        |

**Test prompts:**

- "Fix the typo in the settings-bridge error message and validate"
- "Change the import path in the memory-index spec and verify it passes"
- "Add a new component to hax-design and make sure the tests still pass"

### 2. Structural regression check (weight: 0.25)

Were any obvious link, path, or structural regressions checked?

| Score | Meaning                                                                    |
| ----- | -------------------------------------------------------------------------- |
| 1.0   | Checks for broken imports, missing exports, or invalid paths after changes |
| 0.6   | Checks the immediate change but misses downstream consumers                |
| 0.2   | Only checks that the file itself parses, not that consumers still work     |
| 0.0   | No structural check at all                                                 |

**Test prompts:**

- "Rename `formatMessage` to `formatChatMessage` and validate the codebase"
- "Move the types from the chat protocol file into a shared types file"
- "Refactor the workspace context extension to use the new snippet scoring API"

### 3. Review evidence (weight: 0.20)

Did the task leave enough evidence for a reviewer to understand what was verified?

| Score | Meaning                                                              |
| ----- | -------------------------------------------------------------------- |
| 1.0   | Reports what was run, what passed, and what failed (if any)          |
| 0.6   | Reports that validation ran but omits specifics (e.g., "tests pass") |
| 0.2   | Only reports after a failure, not on success                         |
| 0.0   | No evidence of validation in the output                              |

**Test prompts:**

- "Do the refactor and show me the test results"
- "Update the component and double-check the type check passes"
- "Fix the lint warnings and confirm you've cleaned them all up"

### 4. Gap disclosure (weight: 0.15)

Are follow-up validation gaps called out clearly?

| Score | Meaning                                       |
| ----- | --------------------------------------------- |
| 1.0   | Identifies areas that weren't tested and why  |
| 0.6   | Mentions missing checks only if asked         |
| 0.2   | Conceals or downplays areas that were skipped |
| 0.0   | Claims full coverage when gaps exist          |

**Test prompts:**

- "Add the endpoint and test it manually — note what you couldn't automate"
- "Fix the migration and mention what environments still need verification"
- "Update the docs and flag what remains unclear or unverified"

### 5. Automation gap tracking (weight: 0.10)

If no automated check exists yet, is that absence captured as future work?

| Score | Meaning                                                        |
| ----- | -------------------------------------------------------------- |
| 1.0   | Records missing test coverage as a backlog item or known issue |
| 0.6   | Mentions the gap inline but doesn't persist it                 |
| 0.2   | Acknowledges the gap but doesn't record it                     |
| 0.0   | Ignores the missing check entirely                             |

---

## Overall pass threshold

**Pass:** weighted average ≥ 0.75

```
score = (validation_lane × 0.30) + (structural_check × 0.25)
      + (review_evidence × 0.20) + (gap_disclosure × 0.15)
      + (automation_tracking × 0.10)
```

---

## Autocontext scenario registration

Register a scenario named `regression-checks` that:

- Uses the test prompts above as `task_prompt` inputs
- Targets a Fleet Pi agent session containing code edits and validation tool calls
- Scores against this rubric via `autocontext_judge`
- Re-runs after changes to validation commands, CI configuration, or tool-use policy
