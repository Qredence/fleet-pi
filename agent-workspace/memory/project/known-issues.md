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

## Worker code still imports from `.pi/`

- Issue: AGENTS.md says Cloudflare Worker builds must not import from `.pi/`, but three Worker-bundled modules import `classifyToolPath` / `evaluateWorkspaceWrite` from `.pi/extensions/lib/mutation-tier.ts`.
- Affected area: `apps/web/src/lib/pi/command-policy.ts`, `apps/web/src/lib/pi/plan-mode.ts`, `apps/web/src/lib/pi/durable/spike-harness.ts` (hosted Durable Object path).
- Symptoms: None today; Vite bundles the relative import. The risk is a future `.pi/` change pulling Node-only code into the Worker bundle, and no guard catches it (`worker-bundle-guards.test.ts` has no `.pi/` rule).
- Current status: Open. Found while reviewing the hosted Durable Object cutover (2026-10-15).
- Workaround: Keep `mutation-tier.ts` and its `project-trust` dependency free of Node-only APIs.
- Follow-up: Move `mutation-tier` under `apps/web/src/lib/pi/`, re-export it from `.pi/extensions/lib/`, then add a `.pi/` import rule to `worker-bundle-guards.test.ts`.

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
