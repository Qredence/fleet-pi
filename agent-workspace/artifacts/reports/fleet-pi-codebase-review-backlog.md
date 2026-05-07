# Fleet Pi Codebase Review - Actionable Backlog

Date: 2026-05-07

## P0 - Safety and correctness

### 1. Harden workspace file preview against symlink escapes

- **Impact**: High security and trust boundary improvement.
- **Effort**: Small to medium.
- **Owner surface**: `apps/web/src/lib/workspace/server.ts`, `apps/web/src/lib/workspace/server.test.ts`.
- **Evidence**: `loadAgentWorkspaceFile` validates lexical project-relative paths before opening, but does not realpath the opened file target.
- **Acceptance criteria**:
  - Symlinks inside `agent-workspace` that resolve outside `context.workspaceRoot` are rejected.
  - Absolute paths, traversal paths, directories, missing files, and symlink escapes have explicit tests.
  - Error status codes remain stable for callers.
- **Validation commands**:
  - `pnpm --filter web test -- src/lib/workspace/server.test.ts`
  - `pnpm typecheck`
  - `pnpm lint`

### 2. Replace Plan mode bash regex safety with a command policy seam

- **Impact**: High; Plan mode safety is a core product promise.
- **Effort**: Medium.
- **Owner surface**: `apps/web/src/lib/pi/plan-mode.ts`, new command-policy tests.
- **Evidence**: `isSafeCommand` allows broad `curl` and relies on regex patterns rather than shell parsing or network policy.
- **Acceptance criteria**:
  - Command policy explicitly defines file mutation, process execution, network access, and local-network/metadata access behavior.
  - Pipelines, command substitution, shell executors, redirects, package-manager mutations, and `curl`/`wget` edge cases are tested.
  - Plan mode instructions match the implemented policy.
- **Validation commands**:
  - `pnpm --filter web test -- src/lib/pi/plan-mode.spec.ts`
  - `pnpm typecheck`
  - `pnpm lint`

## P1 - Runtime confidence

### 3. Add a Pi resource-loading expectation test

- **Impact**: Medium-high; prevents silent missing tools in Agent or Plan mode.
- **Effort**: Medium.
- **Owner surface**: `.pi/settings.json`, `.pi/extensions/**`, `apps/web/src/lib/pi/server.ts`, `/api/chat/resources`.
- **Evidence**: Tool allowlists reference `project_inventory`, `workspace_index`, `workspace_write`, and `web_fetch`; `.pi/settings.json` explicitly lists only a subset of extension files/directories.
- **Acceptance criteria**:
  - A test or diagnostic verifies required project-local tools are available to a runtime.
  - `/api/chat/resources` exposes expected skills/extensions or returns actionable diagnostics.
  - Mode allowlists do not reference unknown tools.
- **Validation commands**:
  - `pnpm --filter web test`
  - Manual: open resources canvas and verify required tools/extensions are listed.

### 4. Deepen `apps/web/src/lib/pi/server.ts` into smaller modules

- **Impact**: Medium-high maintainability and testability.
- **Effort**: Medium to large.
- **Owner surface**: `apps/web/src/lib/pi/server.ts`, `/api/chat*.ts`, related tests.
- **Evidence**: The module owns runtime pool, session validation, model resolution, resources, transcript hydration, diagnostics, and tool normalization.
- **Acceptance criteria**:
  - Runtime/session pooling, model catalog, resource catalog, transcript hydration, and tool-part normalization have separate interfaces.
  - Existing route behavior remains unchanged.
  - Tests cover each extracted interface.
- **Validation commands**:
  - `pnpm --filter web test`
  - `pnpm typecheck`
  - `pnpm lint`

### 5. Add workspace file size and media constraints

- **Impact**: Medium; protects UI/server from large or binary preview reads.
- **Effort**: Small.
- **Owner surface**: `apps/web/src/lib/workspace/server.ts`, workspace panel UI.
- **Evidence**: `loadAgentWorkspaceFile` reads the entire file as UTF-8 and only differentiates Markdown by extension.
- **Acceptance criteria**:
  - Large files return a clear preview-too-large response or truncated preview.
  - Binary files return unsupported media metadata instead of UTF-8 content.
  - UI renders these states clearly.
- **Validation commands**:
  - `pnpm --filter web test -- src/lib/workspace/server.test.ts`
  - `pnpm --filter web e2e` if UI states are added.

## P2 - Governance and docs

### 6. Fix current lint blocker

- **Impact**: Medium; restores CI and AGENTS command validation.
- **Effort**: Small.
- **Owner surface**: `apps/web/src/routes/index.tsx`.
- **Evidence**: `pnpm lint` fails on `apps/web/src/routes/index.tsx:585:27` with `@typescript-eslint/no-unnecessary-condition`.
- **Acceptance criteria**:
  - `pnpm lint` passes.
  - `pnpm validate-agents-md` passes.
- **Validation commands**:
  - `pnpm lint`
  - `pnpm validate-agents-md`

### 7. Synchronize generated and operator docs with current architecture

- **Impact**: Medium; reduces onboarding and agent-navigation drift.
- **Effort**: Medium.
- **Owner surface**: `README.md`, `docs/architecture.md`, `docs/project-structure.md`, `docs/api.md`, `scripts/generate-docs.js`.
- **Evidence**: README is more current than generated docs; generated docs omit or under-describe `agent-workspace`, Codex v2, resource/workspace canvas, and workspace API endpoints.
- **Acceptance criteria**:
  - Generated architecture includes browser canvas, workspace endpoints, Pi resources, `agent-workspace`, and Codex v2.
  - API docs include `/api/workspace/tree` and `/api/workspace/file`.
  - Project structure docs include `.pi`, `agent-workspace`, `packages/codex-v2`, and Symphony scripts.
- **Validation commands**:
  - `pnpm generate:docs`
  - `pnpm lint`
  - `pnpm test`

### 8. Record dependency override and `nitro` policy

- **Impact**: Medium supply-chain predictability.
- **Effort**: Small.
- **Owner surface**: `package.json`, `.syncpackrc`, docs or ADR-style note.
- **Evidence**: `nitro` is `latest` and ignored by syncpack; pnpm overrides use lower-bound ranges without local rationale.
- **Acceptance criteria**:
  - Each security override has a short reason and review trigger.
  - `nitro: latest` is either pinned or explicitly justified with an update policy.
- **Validation commands**:
  - `pnpm syncpack`
  - `pnpm build`

### 9. Decide how to treat `jscpd` findings

- **Impact**: Low to medium.
- **Effort**: Small.
- **Owner surface**: `packages/ui/src/components/agent-elements/tools/tool-registry.ts`, small API route wrappers, `.jscpd.json`, CI.
- **Evidence**: `pnpm jscpd` reports 6 clone groups but exits 0.
- **Acceptance criteria**:
  - Duplicates are either refactored, explicitly ignored, or accepted as report-only.
  - CI expectations are documented.
- **Validation commands**:
  - `pnpm jscpd`
  - `pnpm lint`

## P3 - Observability and long-term operations

### 10. Add bundle-size tracking for rich code rendering assets

- **Impact**: Medium performance visibility.
- **Effort**: Medium.
- **Owner surface**: `apps/web`, `packages/ui`, CI build artifacts.
- **Evidence**: `pnpm build` emits many syntax/theme chunks and large server assets.
- **Acceptance criteria**:
  - Bundle report is generated and reviewed in CI.
  - A threshold or trend report flags unexpected growth.
- **Validation commands**:
  - `pnpm build --filter web`
  - Open `apps/web/bundle-report/stats.html`

### 11. Clarify durable memory authority

- **Impact**: Medium; avoids drift between session state and committed memory.
- **Effort**: Medium.
- **Owner surface**: `agent-workspace/index.md`, `agent-workspace/memory/**`, root `memory/**`, `.fleet/sessions`, docs.
- **Evidence**: Durable notes exist in `agent-workspace/memory/**` and root `memory/project/**`; Pi sessions persist hidden JSONL state under `.fleet/sessions`.
- **Acceptance criteria**:
  - Docs state which memory location is authoritative for project decisions, daily notes, research, and active plans.
  - Root `memory/**` is either migrated, explicitly retained, or marked legacy.
  - Session-derived important context has a synthesis flow into `agent-workspace`.
- **Validation commands**:
  - `pnpm tech-debt`
  - Manual doc review
