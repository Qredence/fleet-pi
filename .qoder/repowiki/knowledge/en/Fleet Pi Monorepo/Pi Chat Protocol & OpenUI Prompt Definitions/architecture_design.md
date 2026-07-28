The module is a pure type/schema package with no runtime logic beyond utility functions. It is organized into clear layers:

- `chat-types.ts` declares the core domain types (ChatMessage, ChatMessagePart, ChatStatus) used across the protocol.
- `chat-protocol.ts` defines all request/response/event shapes for the chat API (settings, sessions, models, providers, workspace tree, slash commands, streaming events).
- `chat-protocol.zod.ts` provides parallel Zod validators for every shape in `chat-protocol.ts`, each annotated with `.openapi()` descriptions via `@asteasolutions/zod-to-openapi`, enabling automatic OpenAPI spec generation.
- `model-patterns.ts` implements glob-style model filtering against provider/model identifiers, supporting thinking-level suffix stripping.
- `openui-prompt.ts` builds OpenUI Lang prompts using `@openuidev/lang-core`'s `generatePrompt`, driven by the component signatures declared in `openui-signatures.ts`.
- `provider-catalog.ts` centralizes known LLM provider metadata, env-var names, auth types, and Vercel scrubbing lists.
- `index.ts` re-exports the public surface; `package.json` exposes individual subpath exports (`./chat-types`, `./chat-protocol`, `./chat-protocol.zod`, etc.) so consumers can import only what they need. There are no dependencies on the rest of the monorepo — this package is a leaf contract layer.
