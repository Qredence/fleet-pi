# Fleet Pi Context

Domain vocabulary for contributors and agents working in this monorepo. See
[docs/README.md](docs/README.md) for onboarding and [AGENTS.md](AGENTS.md) for
maintainer commands.

## Packages and seams

| Term            | Location               | Role                                                                                                                                                       |
| --------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **pi-protocol** | `packages/pi-protocol` | Canonical chat wire types (`ChatMessage`, `ChatStreamEvent`), Zod schemas, model patterns, provider credential IDs, and `buildOpenUIPrompt`. No React.     |
| **hax-design**  | `packages/hax-design`  | UI registry: `fleet-pi/` product shell, `agent-elements/` chat UI, `openui/` renderer. Imports protocol types; `lib/pi/*` shims are deprecated re-exports. |
| **web**         | `apps/web`             | TanStack Start app: route adapters only — no local React components.                                                                                       |

**Adapter rule:** Server code imports `@workspace/pi-protocol` for types and prompts. Routes compose `@workspace/hax-design` for UI. Do not import `agent-elements` or `openui` components from server modules.

## Runtime modules (web)

| Term                     | Location                                                   | Interface                                                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **user sandbox context** | `apps/web/src/lib/daytona/resolve-user-sandbox-context.ts` | `resolveUserSandboxContext({ userId, surface }) → { workspaceRoot, sandbox, release, workspaceFS }` — per-user Daytona volume mount shared by chat and workspace surfaces. |
| **chat turn module**     | `apps/web/src/lib/pi/handle-chat-turn.ts`                  | `handleChatTurn({ body, signal, recorder }) → AsyncIterable<ChatStreamEvent>` — streaming turn logic; `/api/chat` handles auth, ownership, and NDJSON piping.              |
| **Pi server runtime**    | `apps/web/src/lib/pi/server-runtime.ts`                    | Session factory, TTL, plan mode wiring; uses sandbox context for Daytona tool FS.                                                                                          |

## agent-workspace (canonical durable layer)

Per **ADR-0001**, canonical project memory lives under
`agent-workspace/memory/project/`:

- `architecture.md`, `decisions.md`, `preferences.md`, `open-questions.md`, `known-issues.md`

Normal “remember this” requests update the narrowest canonical file. Chat-installed
Pi resources live under `agent-workspace/pi/`. `.pi/settings.json` remains the Pi
compatibility bridge.

## Provider model

- **Primary LLM:** Google via Pi `google` provider (default `gemini-3.5-flash`, `GEMINI_API_KEY`).
- **Credential IDs:** `packages/pi-protocol/src/provider-catalog.ts` (core only).
- **Settings UI metadata:** `packages/hax-design/.../provider-metadata.ts` (icons, placeholders).

## Daytona

- **Identity:** One durable sandbox + workspace volume per authenticated user.
- **Surfaces:** `chat` (Pi tool FS + workspace root) and `workspace` (tree/file APIs).
- **Deferred:** Per-session sandboxes, Pi-extension tool re-registration.

## Docs generation

Run `pnpm generate:docs` after changing API routes or architecture boundaries.
Generated files: `docs/api.md`, `docs/architecture.md`, `docs/project-structure.md`.
