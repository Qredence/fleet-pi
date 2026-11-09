# Agent Workspace

If you are new to Fleet Pi, start with [docs/README.md](README.md) and
[Quick Start](quickstart.md) first.

`agent-workspace/` is Fleet Pi's living directory.

For the accepted canonical workspace contract, manifest/section boundary, and
projection rules, see [docs/adaptive-workspace.md](adaptive-workspace.md).

It is the repo-local home for the durable context that lets Fleet Pi behave
like an adaptive and self-improving coding system instead of a stateless chat
window.

## Two workspaces: the team's and each user's

- **This repository's `agent-workspace/`** is the Fleet Pi team's own agent
  home. Its memory, plans, and reports describe Fleet Pi development and are
  never copied to users.
- **Each user's workspace** (their Daytona volume on hosted deploys) starts
  from the neutral seed in `templates/agent-workspace/` and then evolves on
  its own. Fleet Pi never overwrites a file the user or their agent changed;
  newer template copies arrive under `.fleet/template-updates/<version>/`.
  See [Seed template](daytona.md#seed-template).
- **A hosted user without a Daytona key** gets a small built-in workspace in
  their Durable Object (`durable/do-workspace-store.ts`), seeded from the same
  template. The agent can read and write text files (`.md`, `.txt`, `.json`,
  `.yaml`, `.yml`) under `AGENTS.md`,
  `README.md`, `artifacts/`, `evals/`, `instructions/`, `memory/`, `plans/`,
  `pi/skills/`, `pi/prompts/`, `scratch/`, and `system/` (64 KiB per file,
  2 MiB total), but has no shell. The same mutation tiers as the template
  still apply, so `memory/project/**` and `plans/**` need a rationale and
  `evals/**`/`system/**` stay protected. The Workspace panel shows it and can
  edit supported text files (`.md`, `.txt`, `.json`, `.yaml`, `.yml`) except
  the store's own `.fleet/` and `indexes/` bookkeeping.
- **Handing the store over to a volume.** On the first sandbox turn after a
  Daytona key is added, files the agent or the panel wrote in the agent areas
  above are copied to the volume in the background; a file that already
  exists there with different content (an empty file counts) goes to
  `.fleet/do-import/<path>` instead, and a file whose volume copy cannot be
  confirmed stays pending for the next sandbox turn. Panel edits outside those areas (for
  example `manifest.json`) stay in the store and are not handed over. Once
  anything is handed over, the volume is canonical and agent writes are
  rejected; the store keeps serving reads if the sandbox later disappears,
  and the panel can still create new files in it but not change existing
  ones.
- Account deletion erases the store with the Durable Object.

Change the seed only in `templates/agent-workspace/`, and bump its version.

## What lives here

- `memory/` for durable project knowledge
- `plans/` for explicit execution plans and backlogs
- `skills/` for repo-local agent skills
- `evals/` for quality and regression checklists
- `artifacts/` for reports, traces, and reusable outputs
- `scratch/` for safe temporary working files
- `pi/` for workspace-installed Pi skills, prompts, extensions, and packages

## Tool state

Track only tool configuration that is a shared environment contract:
`.agents/setup`, `.agents/resume`, `.amp/services.yaml`, and
`.chunk/config.json`. Agent skills, caches, sessions, and run output stay
ignored (`.agents/skills/`, `.factory/`, `.fleet/`, `.remember/`). Do not add
tool state to `agent-workspace/artifacts/`; that directory holds reviewable
reports and traces.

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

If you want the repo-local agent-facing bootstrap material itself, continue to
[agent-workspace/index.md](../agent-workspace/index.md).
