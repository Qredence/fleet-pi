# Runtime SDK Integration Seams

This page is an implementation reference for deeper platform work. For the
recommended public docs path, start with [docs/README.md](README.md).

This guide maps the current Fleet Pi runtime seams that later adaptive
workspace work must extend without breaking Pi session compatibility, queueing
during streaming, or read-only Plan Mode behavior.

## Current runtime seams

### Runtime construction

- `createSessionServices` is Fleet Pi's wrapper around
  `createAgentSessionServices`.
- `createPiRuntime` builds or reuses the live runtime by combining
  `createAgentSessionRuntime`, Fleet Pi service wiring, model selection, and
  Plan Mode setup.
- `SessionManager` remains the owner of persistent Pi session files, hydration,
  and resume semantics.

### Streaming and queueing

- `/api/chat` streams NDJSON events from the active Pi session.
- The route subscribes to runtime events through `session.subscribe(...)`.
- Follow-up prompting uses the existing queueing during streaming path through
  `queuePromptOnActiveSession`, so new workspace hooks must not start parallel
  assistant turns.

### Plan Mode

- Plan Mode is implemented as a web-native Pi extension plus persisted custom
  session entries.
- It must stay read-only: allowed tools remain inspection-only, and blocked
  shell activity must keep returning an explicit reason instead of mutating the
  repo.

### Resource loading

- The Pi runtime still reads committed project resources from `.pi/`.
- Fleet Pi merges those results with workspace-installed resources discovered
  under `agent-workspace/pi/*`.
- `.pi/settings.json` compatibility bridge remains the handoff between Pi's
  loader and workspace-native resources.

## Safe hook points for the adaptive workspace mission

### Workspace bootstrap

Workspace bootstrap should attach at repo/runtime entrypoints that already know
the active project root, such as workspace API handlers and runtime setup
helpers. The hook must stay best-effort: bootstrap failure may produce
diagnostics, but it must not redefine chat health or rewrite Pi session files.

### Indexing

Indexing should attach after canonical file creation or through explicit
workspace endpoints. It can observe canonical paths, hashes, and semantic
records, but it must treat `agent-workspace/indexes/` as a projection rather
than a durable memory store.

### Provenance

Provenance should attach around the existing runtime event flow:

- session creation and resume
- `session.subscribe(...)` event handling
- tool execution lifecycle events
- canonical file mutations and resource installs

Those records should explain what happened without replacing the canonical files
or the Pi-compatible session history that already exists.

## Non-regression rules

- Preserve Pi session compatibility and existing `SessionManager` semantics.
- Preserve queueing during streaming for follow-up prompts.
- Preserve read-only Plan Mode behavior.
- Preserve `.pi/settings.json` compatibility bridge behavior for workspace
  resources.
- Add workspace bootstrap, indexing, and provenance as extensions around the
  current seams, not as a replacement for them.
