---
name: agent-ui-workflows
description: Build or modify Fleet Pi's React Agent Elements UI, including InputBar controls, tool cards, question prompts, resource drawer, model picker, mode selector, and streaming state.
---

# Agent UI Workflows

Use this skill for UI changes in the chat surface or shared Agent Elements package.

## Key Files

- Chat page composition: `apps/web/src/routes/index.tsx`
- Chat message and tool types: `packages/ui/src/components/agent-elements/chat-types.ts`
- Input composer: `packages/ui/src/components/agent-elements/input-bar.tsx`
- Mode and model controls: `packages/ui/src/components/agent-elements/input/`
- Tool dispatch: `packages/ui/src/components/agent-elements/tools/tool-renderer.tsx`
- Tool metadata: `packages/ui/src/components/agent-elements/tools/tool-registry.ts`
- Question prompt: `packages/ui/src/components/agent-elements/question/`

## Design Rules

- Keep controls compact and scannable; this is an operational coding tool, not a landing page.
- Use existing Agent Elements primitives and direct-file imports.
- Prefer icon buttons with `aria-label` and `title` for compact actions.
- Keep `InputBar` mode/model controls inside `leftActions`.
- Avoid editing `apps/web/src/routeTree.gen.ts` manually.

## Validation

```zsh
pnpm --filter web typecheck
pnpm --filter @workspace/ui typecheck
pnpm --filter web lint
pnpm --filter @workspace/ui lint
```
