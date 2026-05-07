# Fleet Pi Codebase Review - Executive Summary

Date: 2026-05-07
Scope: whole-codebase static review plus local validation of the Fleet Pi monorepo, Pi runtime integration, and `agent-workspace` filesystem/memory harness.

## Overall assessment

Fleet Pi is a coherent and actively governed agent-chat workspace with strong fundamentals: a small pnpm/Turborepo workspace, explicit Pi-backed runtime ownership, repo-local agent memory, and meaningful quality gates. The codebase is beyond prototype maturity, but not yet at a low-risk production operations posture because several safety claims depend on conventions rather than thoroughly tested seams.

Health score: **7.2 / 10**

Confidence: **medium-high** for static architecture and dependency findings; **medium** for live Pi resource-loading behavior because the review did not start the web server or exercise real Bedrock/Pi sessions.

## Top strengths

- **Clear runtime direction**: The chat backend consistently uses `@mariozechner/pi-coding-agent` and Pi sessions rather than mixing agent SDKs.
- **Good workspace discipline**: `pnpm-workspace.yaml`, root `pnpm-lock.yaml`, `syncpack`, `knip`, `jscpd`, `tech-debt`, Husky, and CI jobs create a credible governance surface.
- **Model/provider abstraction respected**: `/api/chat/models` is backed by Pi `ModelRegistry` and `SettingsManager`; the hard-coded Bedrock model is a fallback, not the primary UI list.
- **Session boundary awareness**: Session files are resolved under `.fleet/sessions` with realpath checks before reuse, reducing localStorage session-file escape risk.
- **Visible agent workspace concept**: `agent-workspace/` is documented, seeded, shown in the UI as read-only, and has a policy file describing mutation tiers.

## Top risks

- **High - Plan mode bash allowlist is not a shell-safe policy**: `isSafeCommand` allows broad commands like `curl` and does not parse pipelines or network targets. Plan mode can be read-only with respect to files but still perform network actions or execute fetched content if the bash tool honors the raw command.
- **High - Workspace file preview can follow symlinks outside `agent-workspace`**: `loadAgentWorkspaceFile` validates the lexical path before `open`, but does not realpath the opened file target. A symlink inside `agent-workspace` could preview outside files.
- **Medium-high - Pi resource loading has static drift risk**: source files and allowlists reference `project_inventory`, `workspace_index`, `workspace_write`, `workspace_context`, and `web_fetch`, while `.pi/settings.json` explicitly lists only `bedrock-bearer-auth`, vendored `filechanges`, and vendored `subagents`. Runtime behavior may still auto-discover `.pi/extensions`, but this should be verified by `/api/chat/resources` and tests.
- **Medium - `apps/web/src/lib/pi/server.ts` is too broad a module**: it owns runtime creation, model resolution, session validation, resource listing, diagnostics, transcript hydration, and tool normalization. This reduces locality and makes the interface larger than necessary.
- **Medium - Docs are partially stale**: `README.md` is the most complete, while generated architecture/project/API docs omit or understate `agent-workspace`, Codex v2, right-panel resources, and workspace endpoints.

## Validation snapshot

- **Passed**: `pnpm syncpack`
- **Passed**: `pnpm tech-debt`
- **Passed**: `pnpm knip`
- **Passed with findings**: `pnpm jscpd` exited 0 and reported 6 clone groups.
- **Passed**: `pnpm typecheck`
- **Passed**: `pnpm test` with 50 web Vitest tests and 4 `codex-v2` tests.
- **Passed**: `pnpm build`
- **Failed**: `pnpm lint` on `apps/web/src/routes/index.tsx:585` for `@typescript-eslint/no-unnecessary-condition`.
- **Failed via lint**: `pnpm validate-agents-md` failed only because its dry-run of `pnpm lint` failed.

## Recommended investment areas

1. **Safety hardening**: fix Plan mode bash parsing/network policy and workspace symlink/large-file/binary-file preview boundaries.
2. **Runtime seam deepening**: split Pi server responsibilities into deeper modules with smaller interfaces and direct tests.
3. **Resource-loading verification**: add an integration test or diagnostic assertion proving project-local tools are loaded and active in the intended modes.
4. **Docs synchronization**: regenerate or update architecture, API, and project-structure docs so they reflect the current workspace, Codex v2, resources canvas, and workspace endpoints.
5. **CI cleanup**: fix the lint blocker, decide whether `jscpd` clone groups should fail CI or only report, and add coverage for currently untested safety invariants.
