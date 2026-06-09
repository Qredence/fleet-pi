# Features

Fleet Pi ships a handful of distinct features that work together to give you a persistent, browser-based coding-agent workspace.

| Feature                                  | Description                                                                                                                                                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Chat](./chat.md)                        | Streaming NDJSON chat with the Pi AI coding agent, session persistence across page reloads, follow-up queuing, and Plan-mode question prompts.                                                                                    |
| [Agent workspace](./agent-workspace.md)  | A durable `agent-workspace/` directory that acts as the agent's long-term memory — layered sections for system constraints, project memory, skills, plans, Pi runtime resources, artifacts, and scratch space.                    |
| [Daytona sandbox](./daytona-sandbox.md)  | Per-user isolated Debian containers provisioned on demand via the Daytona platform. When `DAYTONA_API_KEY` is set, Pi tool calls (read/write/edit/bash/grep/find/ls) are proxied into the sandbox instead of running on the host. |
| [OpenUI inline renderer](./openui.md)    | An inline generative UI layer powered by `@openuidev/react-lang`. Pi can emit `openui` fenced blocks inside assistant messages and they render as interactive React components directly in the chat.                              |
| [Memory recall](./chat.md#memory-recall) | Enriched memory retrieval that selects relevant project memory files from `agent-workspace/memory/project/` based on the current prompt before each turn.                                                                         |

## Related pages

- [Chat API](../apps/web/chat-api.md) — API route details for `/api/chat` and supporting endpoints
- [Plan mode](../apps/web/plan-mode.md) — Read-only planning mode and the plan lifecycle
- [Agent-elements UI components](../packages/hax-design/agent-elements.md) — The React component library used to render messages, tool outputs, and the input bar
