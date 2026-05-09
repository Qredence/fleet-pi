---
name: fleet-pi-orientation
description: Map the Fleet Pi codebase before planning or editing. Use when asked what the app does, where chat/session/resource code lives, or how the monorepo fits together.
---

# Fleet Pi Orientation

Use this skill before broad codebase analysis or feature planning.

## Fast Map

- App shell and chat client: `apps/web/src/routes/index.tsx`
- Chat stream route: `apps/web/src/routes/api/chat.ts`
- Supporting chat endpoints: `apps/web/src/routes/api/chat/*.ts`
- Pi runtime/session/resource bridge: `apps/web/src/lib/pi/server.ts`
- Plan mode extension: `apps/web/src/lib/pi/plan-mode.ts`
- Browser-safe chat protocol: `apps/web/src/lib/pi/chat-protocol.ts`
- Shared Agent Elements UI: `packages/ui/src/components/agent-elements/`
- Built-in/project Pi resources: `.pi/skills`, `.pi/prompts`, `.pi/extensions`
- Chat-installed Pi resources: `agent-workspace/pi/skills`,
  `agent-workspace/pi/prompts`, `agent-workspace/pi/extensions`, and
  `agent-workspace/pi/packages`
- Persistent Pi sessions: `.fleet/sessions`

## Workflow

1. Read `AGENTS.md`, `README.md`, and `docs/project-structure.md`.
2. Inspect the files above that match the user's task.
3. Prefer the smallest relevant validation lane from `AGENTS.md`.
4. Mention when generated files such as `apps/web/src/routeTree.gen.ts` should not be edited manually.
