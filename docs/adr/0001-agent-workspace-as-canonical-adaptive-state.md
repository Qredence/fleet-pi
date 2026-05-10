# ADR 0001: `agent-workspace/` as canonical adaptive state

## Status

Accepted — 2026-05-10

## Context

Fleet Pi already keeps durable memory, plans, skills, evals, artifacts, and
workspace-installed Pi resources in repository files. The adaptive-workspace
mission formalizes that file-backed model before later milestones add
bootstrap, indexing, and provenance layers.

The key risk is allowing a cache, projection database, or hidden runtime state
to become the de facto source of truth. That would make the adaptive layer less
reviewable, less revertable, and harder to reconcile with Pi session
compatibility.

## Decision

- `agent-workspace/` is the canonical durable adaptive state for Fleet Pi.
- Any database is a projection and query layer rather than the source of truth.
- durable learning updates write files in canonical workspace paths instead of
  mutating only runtime memory or projection rows.
- Projection database rows point back to files where possible so reviewers can
  trace query results to canonical paths.
- Git diff and revert stay central to reviewing, auditing, and undoing adaptive
  state changes.

## Consequences

### Positive

- Durable memory, plans, skills, evals, artifacts, and workspace-installed Pi
  resources remain inspectable in Git.
- `.pi/settings.json` stays a small compatibility bridge to workspace-native Pi
  resources instead of becoming the adaptive source of truth.
- Later bootstrap, indexing, and provenance work can add speed and diagnostics
  without redefining ownership of the data.
- Projection or indexing failures can be reported as degraded tooling state
  without implying loss of canonical memory.

### Constraints

- `agent-workspace/indexes/` may store projection data, but it must never be
  treated as canonical memory or canonical workspace state.
- Session history must remain Pi-compatible; workspace improvements cannot
  require rewriting persisted Pi session files.
- Read-only Plan Mode boundaries remain in force even as workspace-aware
  diagnostics and provenance hooks are added.

## Non-Goals

- This ADR does not require phase 0 to materialize every contract artifact in
  the live bootstrap path yet.
- This ADR does not replace Pi runtime/session semantics with a workspace-owned
  session format.
