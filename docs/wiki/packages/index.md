# Packages

Fleet Pi has two workspace packages plus the web app:

| Package                                         | Path                    | Description                                                                                           |
| ----------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------- |
| [@workspace/hax-design](hax-design/index.md)    | `packages/hax-design/`  | Shared React UI: fleet-pi shell, agent-elements chat, openui renderer, shadcn/base-nova primitives    |
| [@workspace/pi-protocol](../reference/index.md) | `packages/pi-protocol/` | Chat wire types, Zod schemas, provider credential IDs, model patterns, `buildOpenUIPrompt` (no React) |
| web                                             | `apps/web/`             | TanStack Start app — routes compose hax-design only; Pi runtime in `src/lib/pi/`                      |

Apps import UI from `@workspace/hax-design/*` and protocol types from `@workspace/pi-protocol`. Server code must not import React components from hax-design agent-elements/openui.
