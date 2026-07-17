# ADR 0005: Authority of domain and architecture records

## Status

Accepted — 2026-07-17

## Context

Fleet Pi records its domain vocabulary and architecture across executable
contracts, accepted ADRs, `CONTEXT.md`, project memory, and explanatory or
generated documentation. Without an explicit hierarchy, a stale wiki page or
memory summary can appear to override the runtime contract or an accepted
architectural decision.

## Decision

- Executable types, schemas, manifests, and runtime behavior define the current
  implementation contract.
- Accepted ADRs define binding architectural decisions and their rationale.
  A decision that changes an accepted ADR requires a new ADR that supersedes it.
- Root `CONTEXT.md` is the concise ubiquitous-language reference. It names
  domain boundaries and qualified terms but does not replace executable
  contracts or ADRs.
- `agent-workspace/memory/project/decisions.md` is operational recall and a
  source-linked summary. It must not silently amend or supersede an ADR.
- Wiki pages and generated documentation explain the model and link to the
  authoritative sources. When they disagree with those sources, they are stale
  and must be corrected rather than treated as a competing contract.

## Consequences

- Contributors can identify which artifact governs a disputed statement.
- Vocabulary changes can be recorded in `CONTEXT.md` without duplicating
  implementation details.
- Architectural changes carry durable rationale and remain reviewable through
  ADR history.
- Documentation generation must be corrected at its source before generated
  output is refreshed.
