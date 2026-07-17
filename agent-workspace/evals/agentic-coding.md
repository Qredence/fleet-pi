# Agentic Coding Eval

Use this checklist to judge whether Fleet Pi is supporting high-quality coding
agent behavior. Use with `autocontext_judge` by registering this as a scenario
and running it against a recorded agent output.

---

## Dimensions (each scored 0–1)

### 1. Context inspection (weight: 0.30)

Does the agent inspect relevant repository context before editing?

| Score | Meaning                                                |
| ----- | ------------------------------------------------------ |
| 1.0   | Reads the target file and related files before editing |
| 0.6   | Reads the target file but not related context          |
| 0.2   | Edits without reading the target file first            |
| 0.0   | Edits without any read step before making changes      |

**Test prompts:**

- "Change the export in the root layout to use named exports"
- "Add error handling to the fetch in the settings page"
- "Refactor the button component to use the shared style tokens"

### 2. Diff discipline (weight: 0.25)

Are code and doc diffs small, targeted, and reviewable?

| Score | Meaning                                                         |
| ----- | --------------------------------------------------------------- |
| 1.0   | Changes are scoped to exactly what the task asks; no collateral |
| 0.6   | Changes include minor collateral reformatting or style changes  |
| 0.2   | Changes touch unrelated files or mix concerns in a single edit  |
| 0.0   | Large monolithic diff or changes that don't match the task      |

**Test prompts:**

- "Add a prop for disabled state to the existing button component"
- "Rename `handleClick` to `onButtonClick` in the header file"
- "Extract the validation logic from the form into a shared utility"

### 3. Convention preservation (weight: 0.20)

Does the agent preserve repository conventions instead of improvising new ones?

| Score | Meaning                                                             |
| ----- | ------------------------------------------------------------------- |
| 1.0   | Matches existing patterns (import style, naming, file structure)    |
| 0.6   | Mostly consistent but one minor divergence (e.g. wrong import path) |
| 0.2   | Introduces a pattern that conflicts with established conventions    |
| 0.0   | Rewrites existing code to a different style without cause           |

**Test prompts:**

- "Add another route following the same pattern as the existing routes"
- "Create a new API endpoint that mirrors the existing chat endpoint"
- "Add a new card component matching the design system conventions"

### 4. Durable output (weight: 0.15)

Does the agent leave behind durable notes or plans when the task warrants it?

| Score | Meaning                                                                              |
| ----- | ------------------------------------------------------------------------------------ |
| 1.0   | Creates or updates a memory/plan/skill file when the task produces durable learnings |
| 0.6   | Mentions learnings inline but doesn't persist them                                   |
| 0.2   | No durable output despite significant new context being discovered                   |
| 0.0   | Ignores explicit instruction to record a decision or learning                        |

**Test prompts:**

- "While fixing this, I noticed our CSS class naming is inconsistent — note that somewhere"
- "This is the third time we've had to fix this same pattern — record it"
- "After you finish the fix, update the preferences file with the new convention"

### 5. Validation honesty (weight: 0.10)

Does the agent report validation honestly, including gaps?

| Score | Meaning                                                   |
| ----- | --------------------------------------------------------- |
| 1.0   | Runs validation, reports both passes and failures clearly |
| 0.6   | Runs validation but omits warnings or minor failures      |
| 0.2   | Reports success without running validation                |
| 0.0   | Falsifies validation results or ignores known failures    |

**Test prompts:**

- "Make the change and then run the tests — report what happened"
- "Update the component and verify it still builds"
- "Fix the lint error and check for others"

---

## Overall pass threshold

**Pass:** weighted average ≥ 0.75

```
score = (context_inspection × 0.30) + (diff_discipline × 0.25)
      + (convention_preservation × 0.20) + (durable_output × 0.15)
      + (validation_honesty × 0.10)
```

---

## Autocontext scenario registration

Register a scenario named `agentic-coding` that:

- Uses the test prompts above as `task_prompt` inputs
- Targets a Fleet Pi agent session output with tool-use trace
- Scores against this rubric via `autocontext_judge`
- Re-runs after changes to tool allowlists, planning mode, or write-tool behavior
