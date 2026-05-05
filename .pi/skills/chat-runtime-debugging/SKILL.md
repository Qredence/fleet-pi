---
name: chat-runtime-debugging
description: Diagnose Fleet Pi chat runtime failures, including NDJSON streams, Pi sessions, Bedrock model errors, resource loader diagnostics, queueing, aborts, and Plan mode question flow.
---

# Chat Runtime Debugging

Use this skill when chat requests fail, sessions do not resume, tool cards look wrong, or Plan mode/question flow stalls.

## Triage Order

1. Check the browser-facing route in `apps/web/src/routes/api/chat.ts`.
2. Check Pi runtime creation and session hydration in `apps/web/src/lib/pi/server.ts`.
3. Check Plan mode state and questionnaire handling in `apps/web/src/lib/pi/plan-mode.ts`.
4. Check UI stream consumption in `apps/web/src/routes/index.tsx`.
5. Check shared tool rendering in `packages/ui/src/components/agent-elements/tools/`.

## Common Checks

- `/api/chat/resources` should show resource loader diagnostics without needing Bedrock.
- Stored `sessionFile` values must resolve inside `.fleet/sessions`.
- Live follow-ups and aborts depend on `FLEET_PI_RUNTIME_TTL_MS`.
- Pi tool lifecycle events should normalize into `tool-Read`, `tool-Write`, `tool-Edit`, `tool-Bash`, or generic `tool-*` cards.
- Plan mode can use `read`, `bash`, `grep`, `find`, `ls`, `questionnaire`, `project_inventory`, and `workspace_index`; it must not use `edit` or `write`.

## Validation

Prefer:

```zsh
pnpm --filter web typecheck
pnpm --filter web lint
pnpm dlx tsx --test apps/web/src/lib/pi/plan-mode.test.ts
```
