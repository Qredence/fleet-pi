# AGENTS.md

Fleet Pi is a web workspace for the Pi coding agent: a TanStack Start app on
Cloudflare Workers, a shadcn-style UI package, and a repo-local agent home in
`agent-workspace/`. This file holds the rules agents must follow. Background
and reference detail live in the linked docs. Start with `docs/README.md`,
`CONTEXT.md`, and `DESIGN.md`.

## Commands

Run everything from the repository root with `pnpm`. Use
`pnpm --filter <workspace> <script>` when only one package is affected.
CI runs every backticked `pnpm` command in this file through
`pnpm validate-agents-md`, so only add commands that are safe to execute.

- Setup: `pnpm install`. Devcontainer: `.devcontainer/devcontainer.json`
  (port `3000`, runs `pnpm install` on create).
- Daily: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm e2e`.
- Quality: `pnpm syncpack` (fix drift with `pnpm syncpack:fix`), `pnpm knip`,
  `pnpm jscpd`, `pnpm tech-debt`.
- Docs: `pnpm generate:docs` after doc-generator sources change;
  `pnpm generate:openui-signatures` after OpenUI component signatures change;
  `pnpm validate-agents-md` after editing this file.
- Bundle size: `pnpm build --filter web`, then open
  `apps/web/bundle-report/stats.html`.
- Cloudflare: `pnpm build:cloudflare` when Worker routing changes;
  `pnpm verify-deployment-readiness` before promotion.
- Neon (needs credentials): `pnpm neon:deploy`, `pnpm neon:env-pull`,
  `pnpm neon:verify`, `pnpm auth:migrate`, `pnpm chat:migrate`
  (needs `FLEET_PI_CHAT_MIGRATION_DATABASE_URL`). `neon deploy` provisions
  services only; run both migrations separately.
- Data repair (owner URL; dry-run first, `--purge` only after approval):
  `pnpm quarantine-orphan-sessions`,
  `pnpm remap-auth-user-ids -- --file=remap.csv`.

Deploy steps: `docs/wiki/deployment.md` and
`docs/runbooks/deployment-release-gate.md`.

## Repository map

- `apps/web`: TanStack Start app. Routes in `src/routes/`;
  `src/routeTree.gen.ts` is generated, never edit it. `/api/chat` is
  `src/routes/api/chat.ts`.
- `apps/web/src/lib/pi/`: server-side Pi integration. `runtime/` holds the
  session factory, settings bridge, catalogs, and hot reload. `durable/` holds
  the hosted `UserPiDurable` path. `server.ts` is the route-facing barrel.
- `packages/hax-design`: the only UI source (primitives, `agent-elements/`,
  `components/openui/`, `components/fleet-pi/`).
- `packages/pi-protocol`: browser-safe chat wire layer (types, Zod schemas,
  `chat-types`, provider catalog, OpenUI prompt). No React.
- `.pi/`: Pi compatibility bridge (settings, skills, extensions, vendored
  extensions with `UPSTREAM.md`).
- `agent-workspace/`: the agent's durable home (skills, memory, plans, evals,
  artifacts). See `docs/agent-workspace.md`.

## General rules

- One lockfile: root `pnpm-lock.yaml`. Never create nested lockfiles.
- Put new tests in a `__tests__/` directory next to the code. Write E2E
  artifacts to Playwright `testInfo.outputPath()`, never machine paths.
- `AGENTS.md` is the only agent instruction file; do not recreate `CLAUDE.md`.
- Never commit `defaultProvider`, `defaultModel`, or `enabledModels` in
  `.pi/settings.json`. Users choose models in Settings, and
  `resource-expectations.spec.ts` enforces this.
- When executing an attached plan, do not edit the plan file; finish its todos.
- The pre-commit hook (Husky + lint-staged) runs Prettier and `eslint --fix`
  on staged files in `apps`, `packages`, `.pi/extensions`, and `functions`.
  `git config core.hooksPath` must point at `.husky`. Fix lint errors; do not
  bypass the hook.
- Keep security and isolation audit notes gitignored (`.cursor/hooks/state/`),
  never under tracked `agent-workspace/artifacts/`.

## UI rules

Design context: `DESIGN.md`, `PRODUCT.md`, `packages/hax-design/ARCHITECTURE.md`.

- All UI lives in `packages/hax-design`; routes only compose its exports. Never
  add components under `apps/web/src/components/`. Add registry components
  with `pnpm dlx shadcn@latest add <name> -c packages/hax-design`.
- Inside hax-design use relative imports; apps import `@workspace/hax-design/*`.
- OpenUI library and registry code lives in `components/openui/`. Deepen it
  instead of adopting `@openuidev/react-ui` unless asked.
- No inline `style` props. Use Tailwind, `cva`, co-located CSS, or the
  semantic tokens in `fleet-pi/styles/tokens.ts`. Prefer `fleet-pi/primitives/`
  (`ItemRow` variants) over nested cards or repeated class strings.
- Prefer export-map hygiene over new shell or page-controller layers (for
  example `FleetPiChatShell`) until protocol types settle.
- Header chrome stays floating pills (`bg-sidebar` when inactive,
  `rounded-full`). Panel tabs use `TabsSubtle` (Active Label and pill
  variants) inline when panels are open, and the header stacks above the
  content row (`CHAT_HEADER_LAYER_CLASS`).
- The chat column is one transcript plus the InputBar. The right panel holds
  Workspace, Pi Resources, and Artifacts only, all scoped to
  `agent-workspace/`. Settings (providers, models, skills, appearance,
  sandbox) live in the Settings dialog.
- The Settings dialog follows shadcn sidebar-13: icon+label nav, flat
  `ItemRow` lists, an inline drill-down for Add provider (no nested Dialogs),
  and auto-save via `PATCH /api/chat/settings`.
- Slash suggestions come from `/api/chat/commands`, scroll, and are arrow-key
  navigable. Pi builtins open UI (`/model` opens the picker; `/models`,
  `/settings`, `/config` open Settings); skill and prompt commands go to the
  agent.
- Settings › Providers lists only configured providers. LLM Models curates
  models discovered from them, grouped by provider with an All/Enabled filter.
- Avoid generic AI SaaS looks (cream backgrounds, gradient heroes, card grids)
  and dense IDE toolbars unless asked.

## Chat runtime

Reference: `docs/wiki/apps/web/pi-integration.md`,
`docs/wiki/apps/web/plan-mode.md`, `docs/wiki/api/endpoints.md`.

- Protocol types come from `@workspace/pi-protocol`. The hax-design
  `agent-elements/chat-types.ts` is a deprecated re-export. Server code never
  imports `agent-elements` or `openui` components.
- `handleChatTurn` (`apps/web/src/lib/pi/handle-chat-turn.ts`) owns turn logic.
  The `/api/chat` route only authenticates, parses, and pipes NDJSON.
- Local and legacy sessions are Pi JSONL files. An invalid, outside, or
  missing session file starts a fresh project-scoped session; never surface an
  error. Hosted Agent sessions use `durable:` ids, and their transcript is the
  Durable Object. Legacy Neon Function JSONL is ephemeral, so a failed mirror
  write there still fails the turn.
- File tools and bash cwd stay inside the active project or workspace root.
- Modes: Agent has the coding tools plus approved external tools. Plan is
  read-only: never give it mutating, file-change, subagent, or `fetch_content`
  tools. Harness allows evaluation writes. Allowlists live in `plan-mode.ts`.
- Model choices come from Pi `ModelRegistry`/`SettingsManager`, never a
  hard-coded UI list. `enabledModels: []` means deny-all.

## Hosted deployment (Cloudflare)

Reference: `docs/wiki/deployment.md`, `docs/adr/0004-user-controlled-transcript-deletion.md`.

- Hosted transcripts live in each user's `UserPiDurable` Durable Object. Neon
  holds auth, settings, and an optional projection that must never fail a
  hosted turn. The Daytona volume holds harness files and artifacts. Do not add
  an R2 binding. Neon Object Storage is limited to the private
  `fleet-pi-spike` proof bucket in `neon.ts` (`preview.buckets`) — not for
  transcripts or `agent-workspace`. Productizing more buckets needs an ADR.
- `DELETE /api/chat/account` erases the Durable Object as well as Neon rows.
  Deleting one hosted session is only a tombstone (Pi Durable has no
  per-conversation delete).
- `POST /api/chat/durable-spike` is served only with
  `FLEET_PI_DURABLE_SPIKE=1`; keep it unset in production.
- Worker code must not import from `.pi/`; colocate helpers under
  `apps/web/src/lib/pi/`. Existing exceptions are tracked in
  `agent-workspace/memory/project/known-issues.md`.
- Per-user Pi settings persist in Neon `pi_user_settings`; `.pi/settings.json`
  is not writable on Workers. Fleet base defaults merge from code
  (`fleet-default-project-settings.ts`) and ship no provider or model.
  Settings paths must be portable (no `/Users/…`).
- Org LLM keys (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`, …) never back chat on
  Workers. They are scrubbed from the process. Chat uses signed-in user BYOK
  or the platform Neon AI Gateway.

## Auth and data isolation

Reference: `docs/wiki/security.md`, `docs/runbooks/deployment-release-gate.md`.

- Deploys use Neon Managed Auth (`NEON_AUTH_BASE_URL` / `VITE_NEON_AUTH_URL`).
  Local anonymous or SQLite Better Auth applies only when neither is set.
  `BETTER_AUTH_SECRET` is still required for BYOK encryption.
- Session-scoped chat and workspace APIs require auth on Workers through
  `withAuthenticatedChatRequest`. `auth-mode.ts` stays client-safe; server
  auth lives in `chat-api-auth.ts`.
- Runtime `FLEET_PI_CHAT_DATABASE_URL` must be the non-owner `fleet_pi_app`
  role. `pi_*` tables keep `FORCE ROW LEVEL SECURITY`. Mirror ownership
  probes fail closed.
- Neon Data API stays off (`dataApi: false`). Never grant `authenticated` or
  `anonymous` on `pi_*`, and never expose `neon_auth.*`.
- Run `pnpm chat:migrate` after schema, ownership, or grant changes.

## Providers and models

Reference: `docs/wiki/apps/web/pi-integration.md`.

- Provider ids live in `packages/pi-protocol/src/provider-catalog.ts`. The
  Google id is `google` (`GEMINI_API_KEY`); `GOOGLE_CLIENT_*` are OAuth only.
- The composer picker lists only models the user added. The full catalog is
  Settings-only (`scope=all`).
- OpenAI Chat Completions (`openai-chat-completions`) registers only the
  configured model id, never a remote `/models` catalog. Without OCC BYOK,
  authenticated deploys back it with Neon AI Gateway (`max_tokens` ≤ 25,000).
- Custom providers register as native Pi providers (`custom+<slug>`) and
  reuse `pi_user_providers`; there is no migration.

## Daytona

Reference: `docs/daytona.md`.

- On Workers, sandboxes use only each user's BYOK Daytona key. Org keys and
  `DAYTONA_API_KEY` never back user sandboxes (local dev may use them).
- Volume `fleet-pi-ws-{userId}` mounts only at `/home/daytona/agent-workspace`.
  Seeding never overwrites user files.
- Never block a chat stream on cold sandbox creation; use the cached sandbox
  or a background warm-up.
- The web adapter is `.pi/extensions/daytona-sandbox.ts`. Stock
  `npm:@daytona/pi` is CLI-only; never list it in `.pi/settings.json`.

## agent-workspace and memory

- Durable project memory lives in
  `agent-workspace/memory/project/{architecture,decisions,preferences,open-questions,known-issues}.md`.
  "Remember this" updates the narrowest file; do not create ad hoc memory files.
- `apps/web/src/lib/workspace/server.ts` owns the layout. Seeding creates
  missing Markdown stubs and never overwrites existing files.
- Chat-driven Pi resource installs use `resource_install` and land under
  `agent-workspace/pi/{skills,prompts,extensions,packages}`. Skills and prompts
  apply after reload. Extensions and packages stay staged unless the user asks
  to activate them. "Plugins" means Pi resource packages, not Codex or Claude
  plugin bundles.
- Keep each vendored extension's `UPSTREAM.md` current when refreshing it.

## Docs upkeep

- `README.md` is the public landing page; keep it short. `docs/README.md` is
  the docs hub, and `docs/quickstart.md` is onboarding.
- `docs/api.md`, `docs/architecture.md`, and `docs/project-structure.md` are
  generated. Fix the generator or its sources, never the output.
- Keep `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and issue
  templates aligned with the real maintainer workflow.
- Manual chat checks before release: `docs/wiki/how-to-contribute/testing.md`.

<!-- AUTOCTX_GUIDE_START -->

## AutoContext

- Use `autoctx capabilities` to inspect supported commands and project state.
- Use `autoctx whoami` to confirm provider credentials before running evaluations.
- Run `autoctx run` from this directory to use the defaults stored in `.autoctx.json`.

<!-- AUTOCTX_GUIDE_END -->
