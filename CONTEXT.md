# Fleet Pi Context

Domain vocabulary for contributors and agents working in this monorepo. See
[docs/README.md](docs/README.md) for onboarding and [AGENTS.md](AGENTS.md) for
maintainer commands.

## Domain language

**Canonical adaptive state**:
The durable, reviewable state under `agent-workspace/`: project memory, plans, skills, evals, artifacts, and workspace-installed Pi resources. Indexes, caches, databases, and live runtime objects are not canonical adaptive state.

**Canonical transcript**:
The persisted Pi JSONL session file containing a conversation's messages, tool calls, and results. The Neon session mirror is derived data and may reconstruct an ephemeral transcript copy after an authenticated Vercel cold start; it does not become a second canonical transcript.

**Pi session**:
The persisted JSONL conversation identified by a session file and session ID. Avoid using “session” without a qualifier when referring to Better Auth or a live runtime.

**Live runtime**:
The in-memory `AgentSessionRuntime` serving a Pi session. It is transient, retained for a short TTL, and recreated from the canonical transcript when needed.

**Chat run**:
One streamed execution of a user turn within a Pi session. Avoid calling a run a session: a session can contain multiple runs.

**Agent workspace**:
The durable `agent-workspace/` adaptive-state directory. Avoid bare “workspace” when referring to the project root, a Daytona sandbox workspace root, or the browser’s Workspace panel.

**Plan mode**:
The read-only chat mode for inspection and planning. A **plan artifact** is a durable file under `agent-workspace/plans/`; **chat plan state** and a **plan action** (`execute` or `refine`) are session-level execution state, not the artifact itself.

**Pi resource**:
A skill, prompt, extension, theme, or package understood by Pi. A **workspace-installed Pi resource** lives under `agent-workspace/pi/`; an executable resource may be **staged**, **active**, or **reload-required**. `.pi/settings.json` is the compatibility bridge, not the resource store.

**Canonical filesystem path**:
The normalized path recorded by provenance for a file mutation. This use of “canonical” is about path identity, not ownership of adaptive state or transcripts.

**Workspace section kinds**:
`canonical` sections are durable sources of truth, `temporary` sections are disposable, and `projection` sections are regenerable derived data. The current top-level contract is defined by `workspace-contract.ts` and includes both `instructions` and `system`; policy files are currently seeded under `system/`, not a `policies/` section.

## Documentation authority

Executable types, schemas, and runtime behavior define the current contract. Accepted ADRs record binding architectural decisions and their rationale. This file is the concise domain glossary; wiki pages explain the model and should link to those sources. `agent-workspace/memory/project/decisions.md` is operational recall and a source-linked summary, not an implicit replacement for an ADR.

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

- **Primary LLM:** OpenAI-compatible provider via Pi `openai-chat-completions` (current default model `deepseek-v4-flash-free`), configured through the project OCC settings. Google Gemini, Bedrock, and other providers remain optional integrations.
- **Credential IDs:** `packages/pi-protocol/src/provider-catalog.ts` (core only).
- **Settings UI metadata:** `packages/hax-design/.../provider-metadata.ts` (icons, placeholders).

## Daytona

- **Identity:** One durable sandbox + workspace volume per authenticated user.
- **Surfaces:** `chat` (Pi tool FS + workspace root) and `workspace` (tree/file APIs).
- **Deferred:** Per-session sandboxes, Pi-extension tool re-registration.

## Docs generation

Run `pnpm generate:docs` after changing API routes or architecture boundaries.
Generated files: `docs/api.md`, `docs/architecture.md`, `docs/project-structure.md`.
