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
- Chat-installed Pi runtime resources are canonical under `agent-workspace/pi/`.
  Root `.pi/settings.json` remains the compatibility bridge that points Pi at
  `../agent-workspace/pi/skills`, `../agent-workspace/pi/prompts`, and enabled
  workspace extensions.
- To be filled from repository inspection as architecture notes are distilled.

## Key entry points

- `apps/web/src/routes/index.tsx`
- `apps/web/src/routes/api/chat.ts`
- `apps/web/src/lib/pi/server.ts`
- `apps/web/src/lib/pi/plan-mode.ts`
- `.pi/extensions/resource-install.ts`
- `agent-workspace/pi/`

## Important boundaries

- `resource_install` is Agent-mode only. It can install skills/prompts directly
  into active workspace paths, but executable extensions and package bundles are
  staged unless the user explicitly asks to activate them.

## Data flows worth preserving

- To be filled from repository inspection.
