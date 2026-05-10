# Adaptive Workspace Contract

This guide records the accepted adaptive-workspace contract for Fleet Pi.
Phase 0 documents the contract and its non-regression boundaries; later
milestones make every artifact visible through bootstrap, health, indexing, and
query surfaces without changing the source-of-truth model.

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

## Accepted Workspace Shape

The accepted contract centers on a manifest plus named section families:

```text
agent-workspace/
├── manifest.json
├── instructions/
├── memory/
├── plans/
├── skills/
├── evals/
├── artifacts/
├── scratch/
├── pi/
├── policies/
└── indexes/
```

The contract requires `agent-workspace/manifest.json` to describe the workspace
shape and versioned policy of the adaptive layer. Bootstrap may seed missing
artifacts later, but phase 0 already fixes the names and semantics of the
sections above.

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
- `policies/` holds durable policy and safety artifacts for the workspace.
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

## Current baseline vs later milestones

Fleet Pi already has a committed `agent-workspace/` tree and workspace resource
bridge today. The accepted contract above is the target shape that later
bootstrap and indexing milestones must materialize more completely.

Until those milestones land:

- existing canonical files under `agent-workspace/` remain authoritative
- projection storage stays non-canonical
- `.pi/settings.json` remains a bridge
- runtime and UI work must not quietly move durable adaptive state into
  databases or transient session-only structures
