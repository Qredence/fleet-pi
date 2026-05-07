# Fleet Pi Codebase Review - Technical Deep Dive

Date: 2026-05-07

## Evidence base

Primary files reviewed:

- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, `.syncpackrc`, `knip.json`, `.github/dependabot.yml`, `.github/workflows/ci.yml`
- `README.md`, `AGENTS.md`, `PLANS.md`, `docs/architecture.md`, `docs/project-structure.md`, `docs/api.md`, `docs/runbooks.md`, `WORKFLOW.md`
- `apps/web/src/routes/api/chat.ts`, `apps/web/src/lib/pi/server.ts`, `apps/web/src/lib/pi/plan-mode.ts`, `apps/web/src/lib/pi/chat-protocol.ts`, `apps/web/src/lib/pi/chat-fetch.ts`, `apps/web/src/lib/pi/circuit-breaker.ts`
- `apps/web/src/lib/workspace/server.ts`, `apps/web/src/lib/workspace/layout.ts`, `/api/workspace/*` routes, `agent-workspace/**`
- `.pi/settings.json`, `.pi/extensions/project-inventory.ts`, `.pi/extensions/workspace-index.ts`, `.pi/extensions/workspace-write.ts`, `.pi/extensions/workspace-context.ts`, `.pi/extensions/web-fetch.ts`, `.pi/extensions/vendor/**`
- Unit/e2e test surfaces under `apps/web/src/lib/**/*.test.ts`, `apps/web/src/lib/**/*.spec.ts`, and `apps/web/e2e/chat-flows.e2e.ts`

## System map

Fleet Pi has four primary runtime surfaces:

1. **Browser chat surface**
   - `apps/web/src/routes/index.tsx` owns the main TanStack Start page and delegates the right-side resources/config/workspace canvas to component modules.
   - The browser stores only Pi session metadata and consumes NDJSON events from `/api/chat` through `apps/web/src/lib/pi/chat-fetch.ts` and `use-pi-chat`.

2. **Server chat runtime**
   - `/api/chat` sanitizes the user message, creates or resumes a Pi runtime, subscribes to Pi events, normalizes events into the shared chat protocol, streams NDJSON, and updates Plan mode state.
   - Supporting routes handle models, resources, sessions, resume/new, abort, and question answers.

3. **Pi resource and tool layer**
   - `apps/web/src/lib/pi/server.ts` creates Pi session services, lists resources, resolves model selections, guards session files, and normalizes transcript/tool output.
   - `apps/web/src/lib/pi/plan-mode.ts` is a web-native Pi extension for read-only planning, questionnaire prompts, active tool selection, plan-state persistence, and execute/refine/stay decisions.
   - `.pi/extensions/**` contains project-local and vendored extensions.

4. **Agent workspace and memory harness**
   - `agent-workspace/` is committed as repo-local agent memory, policy, plans, skills, evals, artifacts, Codex v2 state, and scratch.
   - `apps/web/src/lib/workspace/server.ts` seeds expected files and exposes a read-only tree/file preview to the UI.
   - `.pi/extensions/workspace-*` bridges Pi tools into this layout with separate read-only and write behavior.

## Dependency and supply-chain audit

### Findings

- **Workspace shape is controlled**: `pnpm-workspace.yaml` includes only `apps/web`, `packages/ui`, and `packages/codex-v2`; only one `pnpm-lock.yaml` was found, and no nested `package-lock.json` or `yarn.lock` files were found.
- **Version consistency passes**: `pnpm syncpack` reported no issues. `.syncpackrc` enforces `workspace:*` for local packages.
- **Governance is broad**: root scripts cover `build`, `lint`, `typecheck`, `test`, `e2e`, `syncpack`, `knip`, `jscpd`, `tech-debt`, AGENTS validation, Symphony, and Codex v2.
- **Dependabot exists**: `.github/dependabot.yml` runs weekly for npm from `/` and groups minor/patch dev-dependency updates.
- **Security overrides exist but need rationale**: root `pnpm.overrides` pins or lower-bounds `@anthropic-ai/sdk`, `handlebars`, `flatted`, `lodash`, `undici`, `h3`, and TanStack's `h3` subdependency. This is useful, but the reason and sunset condition are not recorded near the overrides.
- **`nitro` remains `latest`**: `apps/web/package.json` uses `nitro: latest`, and `.syncpackrc` explicitly ignores it. The lock currently resolves to a beta `3.0.260429-beta`, which increases upgrade unpredictability.
- **Transitive/schema drift exists**: the lock shows multiple Zod resolutions around Pi/OpenAI/TanStack surfaces. This is not currently breaking, but schema-heavy integrations should avoid silent type/validation shifts.
- **Build output indicates bundle weight risk**: `pnpm build` succeeds, but the output includes many syntax/theme assets and large chunks, including a multi-megabyte server asset. This is expected for rich code rendering but should be tracked deliberately.

### Supply-chain posture

The posture is good for a fast-moving internal app, but the project should move from "commands exist" to "risk decisions are explained." The highest leverage dependency cleanups are pinning or documenting `nitro: latest`, adding comments/rationale for security overrides, and introducing a recurring bundle-size review.

## Architecture review

### Strengths

- **Deep UI package seam**: `packages/ui` exports shared agent-elements types and components behind `@workspace/ui/*`, keeping app-level chat code from owning low-level tool card rendering.
- **Runtime context is centralized**: `apps/web/src/lib/app-runtime.ts` owns `projectRoot` and `workspaceRoot` resolution.
- **Chat protocol is explicit**: `apps/web/src/lib/pi/chat-protocol.ts` defines browser-safe message, session, resource, model, workspace, and stream event types.
- **Circuit breaker is small and testable**: `apps/web/src/lib/pi/circuit-breaker.ts` has a compact interface and direct tests.

### Deepening opportunities

1. **Pi runtime coordinator module**
   - **Files**: `apps/web/src/lib/pi/server.ts`, `/api/chat*.ts`
   - **Problem**: `server.ts` is a very broad module. Its interface exports runtime creation, session actions, resource/model loading, transcript conversion, error helpers, and tool normalization. The implementation is deep, but the interface is also broad, which hurts locality.
   - **Solution**: Split into deeper modules: runtime pool/session repository, model catalog, resource catalog, transcript hydrator, and tool-part normalizer.
   - **Benefits**: Higher locality for session bugs, easier tests at the actual interfaces, and lower risk when changing model/resource behavior.

2. **Plan mode safety policy module**
   - **Files**: `apps/web/src/lib/pi/plan-mode.ts`
   - **Problem**: Plan mode mixes state persistence, prompt injection, questionnaire UI adaptation, active tool switching, and bash safety policy. The bash policy is a shallow regex list relative to the shell behavior it claims to constrain.
   - **Solution**: Create a dedicated command-policy module with parsed command representation, explicit network policy, and tests for pipelines, substitutions, redirects, local network targets, and shell executors.
   - **Benefits**: Better leverage at the safety interface and improved confidence that Plan mode is truly non-mutating and non-dangerous.

3. **Workspace preview guard module**
   - **Files**: `apps/web/src/lib/workspace/server.ts`
   - **Problem**: Tree loading, seeding, path resolution, media typing, and file reading are bundled together. The critical security behavior is inside a helper that does not realpath opened targets.
   - **Solution**: Deepen a `resolveWorkspacePreviewFile` module that validates project-relative input, resolves symlinks, enforces root containment, rejects directories, applies size/media constraints, and returns a safe file descriptor/metadata object.
   - **Benefits**: Security-sensitive invariants become the interface and test surface.

4. **Resource-loading diagnostics module**
   - **Files**: `.pi/settings.json`, `.pi/extensions/**`, `apps/web/src/lib/pi/server.ts`, `/api/chat/resources`
   - **Problem**: Project-local extension presence, settings configuration, active tool names, and UI resource display can drift.
   - **Solution**: Add a resource expectation check that asserts required tools are loaded and mode allowlists reference real tools.
   - **Benefits**: One high-leverage diagnostic protects Agent mode, Plan mode, and the resource browser.

## Pi runtime review

### Request flow

- Browser posts one `message` plus optional session/model/mode metadata to `/api/chat`.
- `/api/chat` trims and sanitizes the message, optionally queues steering/follow-up on an active runtime, creates a Pi runtime, streams `start`, tool, text, thinking, queue, retry, compaction, plan, done, and error events.
- `createPiRuntime` creates session services, validates requested session file reuse, opens or creates a `SessionManager`, creates an `AgentSessionRuntime`, applies model selection, applies Plan mode, tracks the runtime in memory, and returns diagnostics.
- Session hydration uses `SessionManager` entries and converts assistant/tool result history into agent-elements parts.

### Model/provider setup

- Good: `loadChatModels` uses Pi `modelRegistry` and `settingsManager` and falls back only when settings do not define a default.
- Good: Bedrock credentials are environment/profile based; `bedrock-bearer-auth.ts` reads `AWS_BEARER_TOKEN_BEDROCK` and `AWS_REGION`.
- Risk: the default model fallback is embedded in `server.ts`; it is acceptable as a fallback but should remain documented as such.

### Tool allowlists and Plan mode

Static allowlists:

- Agent mode includes Pi coding tools, `workspace_write`, `questionnaire`, `web_fetch`, project resource tools, Autocontext agent/status tools, Autoresearch tools, and `subagent`.
- Plan mode includes read-only Pi tools, `questionnaire`, `project_inventory`, `workspace_index`, and safe Autocontext status tools.

Safety concerns:

- `isSafeCommand` uses regex matching, not shell parsing. It blocks many mutating commands and redirects, but allows broad `curl`, `wget -O -`, `echo`, and `printf` patterns.
- A command can be read-only with respect to local files while still reaching external/internal network targets. Plan mode should define whether network reads are allowed.
- Because the bash tool receives a raw shell command, pipelines and shell executors need explicit tests.

### Resource-loading drift

Static evidence shows `.pi/settings.json` explicitly loads:

- `extensions/bedrock-bearer-auth`
- `extensions/vendor/filechanges`
- `extensions/vendor/subagents`
- npm packages `pi-autoresearch`, `pi-skill-palette`, and `pi-autocontext`

Static source also defines or references:

- `project_inventory`
- `workspace_index`
- `workspace_write`
- `workspace_context`
- `web_fetch`

This may be correct if Pi auto-discovers project-local `.pi/extensions/*.ts`, but the review did not prove that live behavior. Add a runtime test against `loadChatResources` or `/api/chat/resources` to verify required tools are loaded and diagnostics are clean.

## Agent workspace review

### Strengths

- `agent-workspace/index.md` provides a clear entry map.
- `agent-workspace/system/workspace-policy.md` defines free, rationale-required, and protected mutation tiers.
- `workspace_write` implements those tiers with rationale and override checks.
- `loadAgentWorkspaceTree` seeds and returns sorted read-only tree data.
- The workspace is clearly separate from hidden runtime session state in `.fleet/sessions`.

### Boundary gaps

- `loadAgentWorkspaceFile` rejects absolute paths and lexical traversal, but does not realpath the file target after `open`. Symlinks inside `agent-workspace` can therefore escape the intended preview boundary.
- File preview reads the entire target as UTF-8 and only distinguishes Markdown by extension. There is no size cap, binary detection, or explicit unsupported-media response.
- Workspace tests cover positive seeding and file read behavior only. They do not cover absolute paths, traversal attempts, symlink escapes, large files, binary files, missing files, directory paths, or permission errors.
- `workspace_write` rejects any path containing `..`, which is conservative, but it also does not realpath after directory creation. For write safety, parent symlink behavior should be considered.

### Memory model

Fleet Pi currently has several memory/state locations:

- `agent-workspace/memory/**`: durable, reviewable agent memory.
- `memory/project/**`: older/root project memory surface.
- `.fleet/sessions/**`: hidden Pi JSONL session history and custom plan-state entries.
- `agent-workspace/codex-v2/**`: durable Codex v2 plan/run/report artifacts.
- `.pi/npm/**`: ignored project-local Pi package install state.

The preferred authority appears to be `agent-workspace/`, but drift is likely unless docs and tools consistently point there.

## Testing and operations review

### Validation run

| Command                            | Result             | Notes                                                                           |
| ---------------------------------- | ------------------ | ------------------------------------------------------------------------------- |
| `git status --short`               | Pass               | Many pre-existing modified/untracked files were present before report creation. |
| `pnpm list --depth -1 --recursive` | Pass               | Listed root, `web`, `codex-v2`, and `@workspace/ui`.                            |
| `pnpm syncpack`                    | Pass               | No version consistency issues found.                                            |
| `pnpm tech-debt`                   | Pass               | No TODO/FIXME/HACK/XXX/BUG markers in scanned dirs.                             |
| `pnpm knip`                        | Pass               | No unused exports/dependencies reported.                                        |
| `pnpm jscpd`                       | Pass with findings | 6 clone groups reported, mostly tool registry and small API route wrappers.     |
| `pnpm typecheck`                   | Pass               | 3 workspace typechecks successful.                                              |
| `pnpm lint`                        | Fail               | `apps/web/src/routes/index.tsx:585:27` unnecessary optional chain.              |
| `pnpm test`                        | Pass               | 50 web tests and 4 `codex-v2` tests passed.                                     |
| `pnpm build`                       | Pass               | Web and Codex v2 builds passed.                                                 |
| `pnpm validate-agents-md`          | Fail via lint      | Dry-run of `pnpm lint` failed for the same lint issue.                          |

### Test gaps

- Workspace security edge cases are not tested.
- Plan mode bash safety tests cover basic allow/block examples but not shell parsing, pipelines, command substitution, network destinations, or local metadata URLs.
- Resource loading is mocked in E2E tests; live `/api/chat/resources` behavior is not proven.
- E2E chat flows are heavily mocked and useful for UI regressions, but they do not validate real Pi session persistence, Bedrock provider behavior, or live tool execution.
- `apps/web/src/lib/pi/plan-mode.test.ts` was present but not observed in the Vitest output; `plan-mode.spec.ts` is the active Vitest coverage surface.

## Best-practice gaps by severity

### High

- **Plan mode shell safety is under-specified**: regex allow/block lists do not provide a robust shell-safety interface.
- **Workspace preview symlink escape**: realpath validation is missing for opened preview files.

### Medium-high

- **Required Pi tool availability is not asserted**: allowlists and resource files can drift from actual loaded tools.
- **Runtime module has low locality**: `server.ts` concentrates too many responsibilities behind a broad interface.

### Medium

- **Docs drift**: generated docs do not fully reflect current architecture.
- **Lint blocks CI**: one lint error fails both `pnpm lint` and `pnpm validate-agents-md`.
- **Bundle-size visibility is weak**: build succeeds but emits large chunks that should be monitored.

### Low

- **Duplicate-code findings are small but recurring**: jscpd groups are mostly local registry/API wrapper patterns.
- **Override rationale is not recorded**: dependency overrides lack inline policy or linked issue references.
