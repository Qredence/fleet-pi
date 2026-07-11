# ADR 0004: User-controlled transcript deletion

## Status

Accepted — 2026-07-10

## Context

Mirrored Pi sessions store transcripts, runs, tool output, and provider
credentials. Users need owner-scoped deletion and account erasure without
cross-user effects.

## Decision

- `DELETE /api/chat/session` deletes one owned mirrored session (cascade via
  `pi_sessions` FKs) and best-effort ephemeral JSONL cleanup.
- `DELETE /api/chat/account` erases mirrored Pi data for the signed-in user:
  all `pi_sessions` mirror rows and `pi_user_providers` BYOK credentials.
- Deletion uses owner-scoped SQL under RLS; ownership is verified before delete.
- Structured logs record non-content deletion events (`sessionId`, `userId`).
- The endpoint name is historical; it does **not** delete Better Auth identity rows.

## Consequences

- Account erasure removes mirror data but does not automatically delete Better
  Auth identity rows — coordinate auth account deletion separately if required.
- Workspace file mutations on disk are not reverted by mirror deletion; provenance
  remains a separate concern from mirror erasure.
