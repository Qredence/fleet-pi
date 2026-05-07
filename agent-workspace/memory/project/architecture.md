# Fleet Pi Architecture

Use this file for durable, repo-grounded architecture notes.

What belongs here:

- stable structural facts about the app and monorepo
- important runtime boundaries
- key data flows future agents need often
- links to source files that act as architecture anchors

What does not belong here:

- speculative designs
- session-specific debugging notes
- raw command output

Starter template:

## Current snapshot

- Fleet Pi is a browser-based coding-agent chat UI built in this repository.
- The repo contains a web app under `apps/web`, shared UI under `packages/ui`,
  and Pi resources under `.pi/`.
- To be filled from repository inspection as architecture notes are distilled.

## Key entry points

- `apps/web/src/routes/index.tsx`
- `apps/web/src/routes/api/chat.ts`
- `apps/web/src/lib/pi/server.ts`
- `apps/web/src/lib/pi/plan-mode.ts`

## Important boundaries

- To be filled from repository inspection.

## Data flows worth preserving

- To be filled from repository inspection.
