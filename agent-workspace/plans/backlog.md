# Agent Workspace Backlog

## Workspace foundation

- Keep `agent-workspace/index.md` current as the primary entry point.
- Add a lightweight convention for linking completed plans to durable memory.
- Decide when root `PLANS.md` versus `agent-workspace/plans/` should be the
  primary home for resumable execution plans.

## Memory synthesis

- Define a repeatable flow for turning daily notes, traces, and completed work
  into durable project memory.
- Add examples of good memory summaries once real project notes accumulate.

## Doc gardening

- Add a periodic sweep for stale notes, orphaned memory, and contradictory
  policy.
- Define lightweight retention guidance for artifacts and traces.

## Pi extension opportunities

- `.pi/extensions/workspace-index.ts`
- `.pi/extensions/workspace-policy.ts`
- `.pi/extensions/session-inspector.ts`

## UI validation

- Add a Playwright or browser-driven validation skill or extension for Fleet
  Pi's browser UI.
- Decide how screenshots, interaction traces, and UI failures should be stored
  under `artifacts/`.

## Session and observability inspection

- Add local session and log inspection tools for recent Pi sessions.
- Make logs, traces, session events, and runtime diagnostics more
  agent-legible.
