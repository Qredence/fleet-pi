# Adaptive Workspace Contract

This guide records the current adaptive-workspace contract for Fleet Pi. The executable contract is defined by `apps/web/src/lib/workspace/workspace-contract.ts` and materialized in `agent-workspace/manifest.json`; this document explains the domain meaning without introducing a separate target shape.

## Canonical Boundary

`agent-workspace/` is the canonical durable adaptive state.

Durable memory, skills, plans, evals, and artifacts remain path-backed files.
That rule also extends to workspace-installed Pi resources and policy material:
reviewable files win over caches, rows, or hidden runtime state.

`scratch/` is non-canonical temporary space. It can hold disposable working
files, but it is not durable adaptive memory and should never be treated like a
source of truth.

`agent-workspace/indexes/` stores non-canonical projection data. Projection
rows may accelerate search, health, provenance, or query flows, but canonical
files still decide what Fleet Pi knows.

## Current Workspace Shape

The current contract centers on a manifest plus named section families:

```text
agent-workspace/
├── manifest.json
├── instructions/
├── system/
├── memory/
├── plans/
├── skills/
├── evals/
├── artifacts/
├── scratch/
├── pi/
└── indexes/
```

The contract requires `agent-workspace/manifest.json` to describe the workspace
shape and versioned policy of the adaptive layer. Policy files are currently
stored under `system/`; `policies/` is not a current top-level section.

### Section families

- `instructions/` holds durable orientation and operational guidance that
  should survive individual sessions.
- `memory/` holds durable project knowledge, daily notes, and research that
  belongs in canonical files.
- `plans/` holds explicit execution plans and backlog state.
- `skills/` holds repo-local agent skills and supporting examples/evals.
- `evals/` holds checklists, scorecards, and regression-oriented evaluation
  material.
- `artifacts/` holds durable reports, datasets, traces, and reusable outputs.
- `scratch/` holds temporary working files only.
- `system/` holds durable policy, identity, constraints, and safety artifacts for the workspace.
- `indexes/` holds projection/query state only.

## Workspace-installed Pi resources

The canonical home for chat-installed Pi resources is inside `agent-workspace/pi/`:

- `agent-workspace/pi/skills`
- `agent-workspace/pi/prompts`
- `agent-workspace/pi/extensions`
- `agent-workspace/pi/packages`

These directories stay canonical because the installed resource itself is a
reviewable file or directory in the repository.

## `.pi/settings.json` compatibility bridge

`.pi/settings.json` remains the compatibility bridge between the Pi runtime and
workspace-native resources. It may point Pi at `agent-workspace/pi/*`, but it
does not replace the workspace as the durable store.

That means:

- committed `.pi/` configuration can keep loading project-local built-ins
- workspace-installed resources still live under `agent-workspace/pi/`
- changing the bridge must not imply changing where the canonical resource
  content lives

## Current baseline

Fleet Pi materializes the contract above through bootstrap and the workspace
manifest. Existing canonical files remain authoritative, projection storage
stays non-canonical, and `.pi/settings.json` remains a compatibility bridge.
Runtime and UI work must not quietly move durable adaptive state into databases
or transient session-only structures.
