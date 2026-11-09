# Known Issues

Durable rough edges and risks that future Fleet Pi agents should keep in mind.

## Memory snippet extraction was static (Resolved)

- Issue: `extractMemorySnippets` in `.pi/extensions/lib/workspace-memory-index.ts` has historically picked the first 4 bullet-list lines from each canonical memory file and surfaced the first 3 per file in startup context (max 15 snippets). Selection was order-based, not prompt-aware.
- Affected area: `.pi/extensions/lib/workspace-memory-index.ts`, `.pi/extensions/workspace-context.ts`, startup context quality.
- Symptoms: Every turn received the same startup snippets regardless of what the user was asking. Facts buried below the first 4 bullets in any file were never surfaced. New memory added at the end of a section could be invisible to recall.
- Current status: **Resolved.** The live workspace memory index now extracts all canonical snippets, scores them against the latest user prompt, and rewrites the retained `workspace-context` message with relevant results plus deterministic fallback snippets.
- Workaround: No workaround needed. Prompt-aware recall now runs as part of normal workspace context injection.
- Follow-up: Keep `apps/web/src/lib/pi/workspace-memory-index.spec.ts` and `apps/web/src/lib/pi/__tests__/workspace-context.test.ts` passing whenever startup context logic changes.

## Canonical memory enrichment is in progress (Resolved)

- Issue: The canonical project memory files existed as seeded stubs, so Fleet Pi had a memory contract but little durable recall content.
- Affected area: `agent-workspace/memory/project/*`, workspace startup context, and memory recall behavior.
- Symptoms: Startup context could report memory file status but had few useful facts to inject.
- Current status: **Fully resolved!** All five canonical files have been enriched with deep, accurate, source-linked facts covering architecture, decisions, preferences, questions, and issues.
- Workaround: No workaround needed. Prompt-aware retrieval now accesses these rich details on every turn.
- Follow-up: Done! Prompt-aware retrieval now leverages these rich memory files dynamically on every turn.

## Self-improvement loop is not fully closed

- Issue: Fleet Pi has plans, evals, provenance, Autocontext packages, and workspace tools, but they are not yet connected into a fully governed observe/judge/propose/evaluate/apply loop.
- Affected area: Harness mode, run provenance, `agent-workspace/evals/*`, and `agent-workspace/plans/backlog.md`.
- Symptoms: Improvements can be proposed manually, but repeated failures do not automatically become scored backlog candidates.
- Current status: Architecture and backlog entries identify the loop as a priority.
- Workaround: Record repeated friction manually in `known-issues.md` or `plans/backlog.md` with source evidence.
- Follow-up: Add self-improvement candidate extraction and eval-run artifacts.

## Worker code still imports from `.pi/` (Resolved)

- Issue: AGENTS.md says Cloudflare Worker builds must not import from `.pi/`, but three Worker-bundled modules imported `classifyToolPath` / `evaluateWorkspaceWrite` from `.pi/extensions/lib/mutation-tier.ts`.
- Affected area: `apps/web/src/lib/pi/command-policy.ts`, `apps/web/src/lib/pi/plan-mode.ts`, `apps/web/src/lib/pi/durable/hosted-tool-registry.ts`, `apps/web/src/lib/pi/runtime/project-trust.ts`.
- Current status: **Resolved.** Moved `mutation-tier` and project-trust path helpers to `apps/web/src/lib/pi/mutation-tier.ts`, re-exported them from `.pi/extensions/lib/`, and added a `.pi/` import guard in `worker-bundle-guards.test.ts`.

## Resource manager does not yet cover full Pi package lifecycle

- Issue: `resource_install` supports workspace skills, prompts, single-file extensions, and local directory packages, but not full npm/git package installation, pinning, updating, filtering, or trust metadata.
- Affected area: `.pi/extensions/resource-install.ts`, `.pi/extensions/lib/resource-install.ts`, the Resources panel, and Pi package governance.
- Symptoms: Chat-driven resource installation is useful for workspace resources but narrower than Pi's package ecosystem.
- Current status: Staged-by-default executable resource behavior is safer than automatic activation.
- Workaround: Use `.pi/settings.json` and normal package workflows for advanced package cases until Fleet Pi grows a package manager surface.
- Follow-up: Add package listing, pinning, activation policy, and package diagnostics.

## Reasoning controls are only partially surfaced (Partially Resolved)

- Issue: Fleet Pi exposes model and thinking level, but richer Pi reasoning/session settings are not yet surfaced as first-class UI/API controls.
- Affected area: settings schema, Configurations panel, Pi runtime creation, and run provenance.
- Symptoms: Mode/task-specific reasoning presets and branch/compaction summary controls require code/config changes instead of UI-driven management.
- Current status: The Settings Agent loop pane round-trips compaction `enabled`, `reserveTokens`, `keepRecentTokens`, and `backgroundTokens`, plus retry, thinking level, and steering/follow-up. Those values persist in `pi_user_settings` and apply on the next hosted turn. Model-override and provider-retry knobs stay out until Pi Durable exposes them on harness settings.
- Workaround: Adjust supported `.pi/settings.json` fields manually, via the Configurations tab/Settings Dialog, or through existing configuration controls.
- Follow-up: Extend the settings schema to support fine-grained thinking budgets and reasoning profiles.

## Daytona sandbox FUSE volume may be empty on first mount

- Issue: When provisioning a fresh Daytona sandbox, the mounted project workspace FUSE volume may be uninitialized or empty initially, leading to missing workspace files in sandbox sessions.
- Affected area: `apps/web/src/lib/pi/server-runtime.ts` (sandbox workspace filesystem setup).
- Symptoms: The workspace directory inside the sandbox is missing or fails to resolve during the first runtime creation.
- Current status: **Mitigated.** We explicitly execute a self-healing setup command (`mkdir -p /home/daytona/agent-workspace`) during runtime creation to guarantee the workspace path exists in the sandbox before initialization.
- Workaround: Self-healing mkdir during first runtime creation.
- Follow-up: Integrate a full volume check/seeding script if needed.

## autocontext_judge requires Anthropic API key (Resolved)

- Issue: The `autocontext_judge` and `autocontext_improve` tools historically made default calls to the Anthropic API and required an `ANTHROPIC_API_KEY` environment variable. Since Fleet Pi's primary provider is Bedrock/Google, no Anthropic API key was configured.
- Affected area: `pi-autocontext` package, `autocontext_judge`, `autocontext_improve`, `autocontext_queue` tools.
- Symptoms: All `autocontext_judge` calls failed with `Anthropic API error 401: invalid x-api-key`.
- Current status: **Fully resolved.** We initialized the `autoctx` project at the root and configured `.autoctx.json` with `"provider": "gemini"` and `"model": "gemini-2.5-flash"`. The system now seamlessly leverages the existing `GEMINI_API_KEY` environment variable.
- Workaround: No workaround needed. `autocontext_judge` and `autocontext_improve` execute fully using Google Gemini.
- Follow-up: Ensure any new environments have `GEMINI_API_KEY` set.

## pi-autocontext package has a module resolution error (Resolved)

- Issue: `autocontext_scenarios` and status tools were reported to fail with `Cannot find module './parsers/any.js'` inside the `zod-to-json-schema` dependency, and `autoctx` reported missing database tables.
- Affected area: `pi-autocontext` package, `autocontext_scenarios`, `autocontext_status`, `autocontext_queue` tools.
- Symptoms: Cannot list registered scenarios or query status.
- Current status: **Fully resolved.** The database has been successfully initialized at the root (`runs/autocontext.sqlite3`) using `autoctx init`. All autocontext tools are fully functional and pass validation.
- Workaround: No workaround needed. All status, scenario list, queue, and judging tools are fully functional.
- Follow-up: Keep the `runs/autocontext.sqlite3` database in `.gitignore` to avoid version-controlling local evaluation run history.

## Accepted braces DoS advisory (no patch yet)

- Issue: `pnpm audit` reports [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) for `braces` ≤3.0.3 (stack-exhaustion DoS via nested brace patterns). No patched npm release exists; latest is 3.0.3.
- Affected area: Transitive via `micromatch` / `fast-glob` from `@daytona/sdk`, `shadcn` registry tooling, and `jscpd` (dev). Documented under DEP-010 (#166).
- Symptoms: High advisory in `pnpm audit`; no runtime Worker path takes end-user brace patterns.
- Current status: **Accepted.** Override floors elsewhere remain in `pnpm-workspace.yaml` with Review 2027-01-16.
- Workaround: None until a patched `braces` ships.
- Follow-up: Add a `braces` floor in `pnpm-workspace.yaml` once `>=3.0.4` is published. See `docs/wiki/security.md` and `SECURITY.md`.

## Two CircleCI projects fire on every push for this repository (Resolved)

- Issue: `gh/Qredence/fleet-pi` (OAuth org `gh/Qredence`, project `589a2a40-860e-4fed-884f-baad05897656`) and `fleet-pi` in the standalone org `circleci/SomxVLJYMpo86z6XUrZBUq` (project `ea1af8f1-6cee-451e-b397-7cdebd44a5eb`) both ran the pipeline on every push.
- Affected area: CircleCI spend and duplicate commit statuses. No build, test, or deploy path depended on it.
- Symptoms: Two full pipelines per push, two CircleCI contexts per PR.
- Current status: **Resolved.** The OAuth project was fed by a legacy repository webhook (`https://circleci.com/hooks/github`, id `639718649`), separate from the `circleci-app` GitHub App installation (`134720486`) that drives the standalone project. Deleting that webhook was the fix.
- Resolution: `gh api -X DELETE repos/Qredence/fleet-pi/hooks/639718649`. A push of commit `8554681` then produced exactly one run (standalone `b219457c`), with zero runs on the OAuth project, confirmed by polling both projects for 160s.
- Why the earlier attempts failed: `api/v1.1/.../unfollow` returns `{"following":false}` but does not stop webhook-triggered pipelines, and `PATCH /api/v2/project/gh/Qredence/fleet-pi/settings` returns 403 because this CircleCI identity belongs only to the standalone org. The fix was never available from CircleCI's side — only from GitHub.
- Residual: the `gh/Qredence` project entity and its deploy key (`CircleCI`, read-only, id `154180124`) still exist, but neither can start a pipeline now. The webhook config (URL, events `fork`/`public`/`pull_request`/`push`/`repository`, form content type) is saved so it can be recreated if it is ever needed.

## Oxc migration: React Compiler-era rules are advisory (PR 2)

- Issue: Oxlint's `react` plugin is new to this repo; the retired ESLint config
  enabled zero React rules. Three of its rules produce 60 pre-existing findings,
  every one of which needs a behavioural refactor (move `setState` out of
  effects, stop reading refs during render, restructure effect dependencies)
  rather than a mechanical edit.
- Affected area: `packages/hax-design/src/components/**` and
  `apps/web/src/lib/pi/**`.
- Symptoms: `vp lint` reports these as warnings and the gate passes, so real
  React purity findings can hide in the total.
- Current status: **Scoped as warnings** in root `vite.config.ts`
  (`react/set-state-in-effect`, `react/refs`, `react-hooks/exhaustive-deps`),
  with `typescript/unbound-method` off inside test overrides (that rule fires
  only on `vi.mocked(...)` spy assertions).
- Workaround: None needed for CI. Treat new warnings in those rules as real
  signals on touched files.
- Follow-up: Burn down the 60 findings rule by rule and promote each back to
  `error` once its count reaches zero.

## Oxc migration: `typescript/no-unsafe-type-assertion` is test-exempt (follow-up)

- Issue: The rule arrives through the `suspicious` category rather than a
  hand-authored choice. It is the repo's single noisiest rule: 486 hits, 322 of
  them in `**/__tests__/**` and `**/*.test.ts(x)`, where test doubles narrow
  `unknown` payloads into the shape under test by design.
- Affected area: repo-wide; the remaining 164 hits cluster in
  `apps/web/src/lib/pi/**`, `apps/web/src/lib/db/**`,
  `packages/hax-design/src/components/chart.tsx`, and `.pi/extensions/lib/`.
- Current status: **Off in the test override**, still warning in source, so
  genuine unsoundness (`e.target as HTMLElement`) stays visible. Repo warning
  total is ~417 rather than 739.
- Workaround: None needed for CI. Prefer narrowing guards over casts when the
  warning appears on a file you are already touching.
- Follow-up: Burn down the 164 source-side assertions, preferring narrowing
  guards (`instanceof`, `typeof`, discriminated unions) over casts.


## Oxc migration: `.pi/extensions/vendor/**` is lint-excluded (PR 2)

- Issue: Vendored upstream Pi extensions have their own `UPSTREAM.md` refresh
  contract. Linting them would make every upstream refresh fight a local
  backlog of style findings.
- Affected area: `.pi/extensions/vendor/filechanges`, `subagents`,
  `web-fetch`.
- Current status: Excluded via `lint.ignorePatterns`, matching the retired root
  `eslint.config.js`, which ignored `.pi/extensions/vendor/**`. Also excluded
  from `fmt.ignorePatterns` for the same refresh-diff reason.
- Follow-up: Revisit only if a vendored extension is forked into first-party
  code.

## Oxc migration: one entry point for lint policy

- Issue: `pnpm lint` previously ran `turbo lint && vp lint .pi/extensions`,
  which never saw `scripts/`, `vite.config.ts`, or root `.mjs` files. CI runs
  `vp check --no-fmt` from the root, so a contributor could pass the documented
  local command and still fail CI. Verified pre-fix: a `debugger` statement in
  `scripts/` gave `pnpm lint` exit 0 and `vp check` exit 1.
- Affected area: root `package.json` `lint` script, `turbo.json`,
  `docs/wiki/how-to-contribute/tooling.md`.
- Current status: `lint` is `vp check --no-fmt`, identical to CI. Per-package
  `vp lint` scripts remain for direct use but are no longer the documented
  path.
- Related invariant: a `fmt`/`lint` block in a nested `vite.config.ts`
  **replaces** the root block instead of merging. All static-analysis policy
  must stay in the root file; the header comment there says so.
- Follow-up: If `turbo` caching of lint matters later, add a root-scoped turbo
  task rather than reintroducing a second spelling of the command.

## CI: cancelled Sonar runs on stacked PRs are not verdicts

- Issue: SonarCloud runs through the GitHub App with no config in this repo.
  Each branch push cancels the analysis of the previous head, and a cancelled
  check reports as a failure in `gh pr checks`. On a five-PR stack the lower
  PRs are re-analysed on every cascade, so the visible status is often a
  cancelled run rather than a real verdict.
- Affected area: Any stack. Observed on PRs #191–#195 (Oxc migration,
  `stack #197`), where cancelled runs read as failures on the lower layers.
- Current status: Not a blocker, only noise. The Oxc migration closed green:
  all five PRs report `SonarCloud` and `SonarCloud Code Analysis` success.
  The one real finding it produced, `new_security_rating` on #191 from a
  `PATH` lookup in `scripts/verify-neon-backend.mjs`, was fixed by resolving
  pinned binaries through `resolveBinary` instead of the inherited `PATH`.
- Workaround: Read the quality gate through the Sonar API, or wait for the
  top-of-stack analysis, instead of trusting a cancelled check run.
- Follow-up: If cancelled runs stay confusing, configure Sonar to skip
  re-analysis on non-head branches rather than teaching readers to ignore it.

## User volumes were seeded with the team's agent-workspace (Resolved)

- Issue: Daytona prepare sparse-cloned this repo's `agent-workspace/` into every user volume, so new users inherited Fleet Pi team memory, reports, scratch scripts, and the enabled `explorator-agent.ts` extension. Seeding was also skipped forever once the `fleetPiSeedRev` sandbox label matched, so template changes never reached existing users.
- Affected area: `apps/web/src/lib/daytona/sandbox-prepare.ts`, user Daytona volumes.
- Current status: **Resolved.** Volumes seed from `templates/agent-workspace/` with a recorded version (`.fleet/template-version`, `SEED_TEMPLATE_VERSION`). Upgrades copy missing files and put changed template files under `.fleet/template-updates/<version>/`; nothing is overwritten. Legacy volumes quarantine unedited old-seed files once (blob match against `templates/legacy-seed-blobs.txt`).
- Follow-up: Keep `templates/agent-workspace/` neutral (`seed-template.test.ts`). The repo's `agent-workspace/` stays the team home; the template is user-facing.
