# ADR 0003: Owner-only Pi session mirror on Vercel

## Status

Accepted — 2026-07-10

## Context

The Neon `pi_*` mirror had legacy ownerless sessions. Vercel must never create
or update mirror rows without an authenticated `user_id`. Cross-user access must
return `401`/`403`.

## Decision

- `assertMirrorOwnerForPersistence(userId)` guards all Vercel mirror writes.
- `enforceChatSessionOwnership` covers session-scoped chat routes.
- `enforceRunOwnership` covers `/api/chat/run` via `pi_runs` + RLS.
- Preview/production provenance path queries filter to the caller's mirrored
  session IDs on Vercel.
- Neon mirror is the authenticated recovery source for ephemeral JSONL after cold
  starts (`recoverOwnedSessionFile`).
- Legacy ownerless rows are quarantined then purged via
  `pnpm quarantine-orphan-sessions` after explicit approval — never auto-claimed.

## Consequences

- Local dev without `FLEET_PI_CHAT_DATABASE_URL` keeps anonymous sessions.
- Vercel persistence errors when auth is missing instead of writing orphan rows.
- Session resume/hydrate paths pass `userId` for recovery and sync.
