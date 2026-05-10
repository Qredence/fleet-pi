# Agent Workspace

`agent-workspace/` is Fleet Pi's living directory.

For the accepted canonical workspace contract, manifest/section boundary, and
projection rules, see [docs/adaptive-workspace.md](adaptive-workspace.md).

It is the repo-local home for the durable context that lets Fleet Pi behave
like an adaptive and self-improving coding system instead of a stateless chat
window.

## What lives here

- `memory/` for durable project knowledge
- `plans/` for explicit execution plans and backlogs
- `skills/` for repo-local agent skills
- `evals/` for quality and regression checklists
- `artifacts/` for reports, traces, and reusable outputs
- `scratch/` for safe temporary working files
- `pi/` for workspace-installed Pi skills, prompts, extensions, and packages

## Why it matters

Fleet Pi keeps important agent context in normal repository files so that:

- project memory can be reviewed and refined over time
- plans stay visible to humans and agents
- newly installed Pi resources are discoverable instead of hidden in transient
  runtime state
- self-improvement remains part of the repository's change history

## Relationship to `.pi/` and `docs/`

- `docs/` is the human-facing documentation surface
- `agent-workspace/` is the agent-facing operational surface
- `.pi/` contains committed project Pi configuration and built-in runtime
  bridges
- `agent-workspace/pi/` is the canonical home for chat-installed Pi resources

Root `.pi/settings.json` remains a compatibility bridge that points Pi at the
workspace-native resource directories.

## Durable self-improvement

Fleet Pi is intentionally opinionated here:

- durable improvements belong in reviewable Git diffs
- canonical memory should live in the smallest relevant file
- ad hoc notes should stay temporary unless they are later synthesized
- transient runtime/session state should not be treated as the source of truth

If you are new to the workspace, start with
[agent-workspace/index.md](../agent-workspace/index.md).
