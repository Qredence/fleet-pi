# Memory Synthesis Skill

## When to use it

Use this skill when raw notes, completed plans, traces, or repeated
observations need to become durable memory that future agents can rely on.

## Inputs

- `memory/daily/**`
- completed or abandoned plans
- useful traces or reports
- repeated observations from recent implementation work

## Outputs

- concise updates to `memory/project/**`
- distilled notes in `memory/summaries/**`
- targeted research-note updates when outside guidance affects Fleet Pi

Canonical project memory files:

- `memory/project/architecture.md` for stable structure, runtime boundaries,
  and recurring data-flow facts
- `memory/project/decisions.md` for decisions and rationale
- `memory/project/preferences.md` for stable user or project preferences
- `memory/project/open-questions.md` for unresolved questions
- `memory/project/known-issues.md` for durable rough edges and workarounds

## Procedure

1. Gather raw material from daily notes, plans, traces, and recent task
   summaries.
2. Remove one-off chatter, duplicated facts, and transient command output.
3. Group surviving facts by durable purpose: architecture, decisions,
   preferences, known issues, or open questions.
4. Write the smallest update that would help a future agent act better.
5. Prefer the canonical project memory file that matches the fact. Create an
   ad hoc project-memory file only when explicitly requested, for temporary
   harness tests, or for raw material that will be synthesized later.
6. Link back to the triggering plan, artifact, or repository evidence when
   helpful.

## Quality checklist

- The synthesized note is shorter and clearer than the raw material.
- Claims are grounded in repository evidence or clearly labeled as tentative.
- The destination file is the narrowest one that fits.
- No raw logs or daily-note chatter were promoted unchanged.
- A future agent could tell why this memory matters.
