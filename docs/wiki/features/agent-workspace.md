# Agent workspace

`agent-workspace/` is Fleet Pi's **canonical adaptive state**. It lives inside the repository and gives Pi a place to accumulate project knowledge, reusable procedures, active plans, and runtime resources that survive across chat sessions. Everything in it is version-controlled Markdown (or JSON), so changes show up as normal Git diffs and can be reviewed, reverted, or diffed just like code.

This **agent workspace** is distinct from the project root, a Daytona sandbox workspace root, and the browser's `Workspace` panel. Pi JSONL session files are the separate **canonical transcript** for conversation history; the workspace does not own transcript history.

## Current top-level contract

The current contract has these top-level sections:

- `instructions/`, `system/`, `memory/`, `plans/`, `skills/`, `evals/`, `artifacts/`, and `pi/` are **canonical**.
- `scratch/` is **temporary** and must not be treated as durable adaptive state.
- `indexes/` is a **projection** and can be regenerated from canonical files.

Policy files are currently seeded under `system/` (`workspace-policy.md`, `tool-policy.md`, `self-improvement-policy.md`, and `constraints.md`). There is no separate current `policies/` top-level section. Any future restructuring must be documented as a proposal rather than treated as the current contract.

The workspace is organised into a strict layer stack. Higher layers are more stable; lower layers change more frequently. The top-level section names and kinds in the current contract come from `apps/web/src/lib/workspace/workspace-contract.ts` and `agent-workspace/manifest.json`.

```
system/       Identity, constraints, policies         (protected — rarely changes)
    ↓
memory/       Project knowledge, decisions            (rationale required)
    ↓
skills/       Reusable procedures and workflows       (rationale required)
    ↓
plans/        Active work, backlog, completed plans   (rationale required)
    ↓
pi/           Chat-installed runtime resources        (mutable with synthesis)
    ↓
artifacts/    Reports, traces, generated outputs      (freely mutable)
    ↓
scratch/      Ephemeral temporary files               (freely mutable)
```

Each layer has a _kind_:

| Kind         | Examples                                                       | Rule                                                              |
| ------------ | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `canonical`  | `system/`, `memory/`, `skills/`, `plans/`, `pi/`, `artifacts/` | Source of truth — never regenerated                               |
| `temporary`  | `scratch/`                                                     | Ephemeral — do not depend on contents persisting                  |
| `projection` | `indexes/`                                                     | Derived — regenerable from canonical data, never canonical itself |

## Mutation tiers

How freely any path can be modified is governed by the mutation tier system defined in `agent-workspace/ARCHITECTURE.md`:

| Tier               | Paths                                                                                     | Rule                                            |
| ------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Free               | `scratch/**`, `artifacts/**`, `memory/daily/**`                                           | Write without explanation                       |
| Rationale required | `memory/project/**`, `memory/research/**`, `memory/summaries/**`, `plans/**`, `skills/**` | Include synthesis or justification              |
| Protected          | `system/**`, `evals/**`                                                                   | Requires explicit user override or harness mode |

Agents in normal Agent mode treat rationale-required paths as writable but must include a justification comment. Protected paths require the user to explicitly enable harness mode.

## Memory accumulation

Project knowledge lives in five canonical Markdown files under `memory/project/`:

| File                | Content                                                 |
| ------------------- | ------------------------------------------------------- |
| `architecture.md`   | How the app is structured                               |
| `decisions.md`      | Significant technical decisions and their reasoning     |
| `preferences.md`    | User-stated preferences and working-style notes         |
| `open-questions.md` | Unresolved questions that should inform future turns    |
| `known-issues.md`   | Bugs, limitations, or rough edges the agent is aware of |

A "remember this" request should update the narrowest canonical file that matches. Ad hoc memory files are only created when explicitly requested or when raw material is being collected for later synthesis.

Daily observation logs go to `memory/daily/` (free tier). Research notes from web searches or deep investigation go to `memory/research/`.

## Skill growth

Each skill lives in `skills/<name>/SKILL.md` with optional supporting files (`changelog.md`, `evals.md`, `examples.md`). After complex or repeatable tasks, the agent is expected to capture the key procedure as a workspace skill so future turns benefit from it without re-deriving it.

Skills in `agent-workspace/skills/` are workspace-local and available in every session. Skills installed via chat (`resource_install`) land in `agent-workspace/pi/skills/` and become available after reload.

## Plans as first-class artifacts

Plans are versioned, reviewable files rather than implicit session state.

```
plans/
  active/      Current work in progress
  completed/   Finished plans with outcomes recorded
  abandoned/   Suspended work with rationale
  backlog.md   Future work queue
```

When Plan mode produces a numbered plan, it is written to `plans/active/` with metadata Pi can reference across turns. After execution, the plan moves to `plans/completed/` with a short outcome note.

## Pi integration model

The workspace bridges Pi's own resource system through a compatibility layer:

```
.pi/settings.json              Points Pi at workspace-native resource paths
.pi/extensions/                Executable runtime bridges (bedrock-auth, resource-install, etc.)
agent-workspace/pi/skills/     Chat-installed Pi skills
agent-workspace/pi/prompts/    Chat-installed Pi prompts
agent-workspace/pi/extensions/ Staged and enabled extensions
agent-workspace/pi/packages/   Package bundles
```

`.pi/settings.json` is the bridge file. It makes workspace resources loadable by the Pi SDK without requiring Pi to know about the `agent-workspace/` layout. Extensions and packages are **staged by default** — the user must explicitly activate them. Skills and prompts become usable after a new session or page reload.

`resource_install` is the chat-driven entry point for installing new Pi resources. It routes to the right subdirectory and updates `.pi/settings.json` as needed.

## Bootstrap

On every request that needs the workspace, `bootstrapAgentWorkspace` (`apps/web/src/lib/workspace/bootstrap-agent-workspace.ts`) runs a health check and fills any gaps:

1. Ensures the `agent-workspace/` root directory exists.
2. Creates all required section directories from `WORKSPACE_SECTION_DEFINITIONS` and `WORKSPACE_REQUIRED_DIRECTORY_PATHS` (see `apps/web/src/lib/workspace/workspace-contract.ts`).
3. Seeds the four policy files under `system/` with minimal starter content (`wx` flag — never overwrites an existing file).
4. Writes or validates `manifest.json` against the typed `workspaceManifestSchema`.
5. Creates the scratch protection `.gitkeep` so the empty `scratch/tmp/` directory is tracked by Git.
6. Initialises the SQLite projection database under `indexes/`.

The function returns a `WorkspaceHealthResponse` with detailed diagnostics. Status is `"ok"` when the manifest is valid and no error-level diagnostics are present; otherwise it is `"degraded"`.

Bootstrap is **idempotent and non-destructive** — it never overwrites user-authored files because all file writes use the `wx` (exclusive create) flag.

## Directory layout

```
agent-workspace/
  system/          Constraints, identity, policies (protected)
  memory/
    project/       Canonical project knowledge (5 files)
    daily/         Daily observation logs (free)
    research/      Research notes (rationale required)
  skills/          Reusable agent procedures
  plans/
    active/        Current work
    completed/     Finished plans
    abandoned/     Suspended work
    backlog.md     Future work queue
  pi/              Chat-installed Pi resources
    skills/
    prompts/
    extensions/
      enabled/
      staged/
    packages/
  artifacts/
    reports/
    datasets/
    traces/
    diagrams/
  scratch/
    tmp/
  indexes/         Projection database (non-canonical)
  manifest.json    Section registry
  ARCHITECTURE.md  This layering model
  AGENTS.md        Always-injected operating context
```

## Key source files

| File                                                      | Role                                                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `agent-workspace/ARCHITECTURE.md`                         | Authoritative description of the layering model and mutation tiers                       |
| `apps/web/src/lib/workspace/workspace-contract.ts`        | TypeScript constants for all section definitions, required directories, and policy files |
| `apps/web/src/lib/workspace/bootstrap-agent-workspace.ts` | Bootstrap and health-check logic                                                         |
| `apps/web/src/lib/workspace/server.ts`                    | Server helpers: sorted filesystem tree, safe file preview                                |

## Related pages

- [Chat](./chat.md)
- [Chat API](../apps/web/chat-api.md)
- [Plan mode](../apps/web/plan-mode.md)
