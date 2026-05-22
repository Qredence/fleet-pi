# Known Issues

Durable rough edges and risks that future Fleet Pi agents should keep in mind.

## Memory snippet extraction is static

- Issue: `extractMemorySnippets` in `workspace-memory-index.ts` always picks the first 4 bullet-list lines from each canonical memory file and surfaces the first 3 per file in startup context (max 15 snippets). Selection is order-based, not prompt-aware.
- Affected area: `.pi/extensions/lib/workspace-memory-index.ts`, `.pi/extensions/workspace-context.ts`, startup context quality.
- Symptoms: Every turn receives the same 15 snippets regardless of what the user is asking. Facts buried below the first 4 bullets in any file are never surfaced. New memory added at the end of a section may be invisible to recall.
- Current status: A prompt-aware retrieval plan using `workspace_index` search scoring is actively being implemented as part of the memory-recall improvement plan.
- Workaround: Place the most broadly useful, frequently relevant facts at the top of each section in canonical memory files so they are likely to be in the first 4 bullets.
- Follow-up: Implement keyword-scored retrieval in `workspace-memory-index.ts` and validate with a `memory-recall.md` autocontext eval.

## Canonical memory enrichment is in progress

- Issue: The canonical project memory files existed as seeded stubs, so Fleet Pi had a memory contract but little durable recall content.
- Affected area: `agent-workspace/memory/project/*`, workspace startup context, and memory recall behavior.
- Symptoms: Startup context could report memory file status but had few useful facts to inject.
- Current status: Memory files are actively being enriched as part of the memory-recall improvement plan. All five canonical files now have substantive content.
- Workaround: If recall is insufficient, inspect `agent-workspace/memory/project/*` directly and synthesize missing durable facts into the narrowest canonical file.
- Follow-up: Add prompt-aware memory retrieval and a memory-recall eval to detect regressions.

## Self-improvement loop is not fully closed

- Issue: Fleet Pi has plans, evals, provenance, Autocontext packages, and workspace tools, but they are not yet connected into a fully governed observe/judge/propose/evaluate/apply loop.
- Affected area: Harness mode, run provenance, `agent-workspace/evals/*`, and `agent-workspace/plans/backlog.md`.
- Symptoms: Improvements can be proposed manually, but repeated failures do not automatically become scored backlog candidates.
- Current status: Architecture and backlog entries identify the loop as a priority.
- Workaround: Record repeated friction manually in `known-issues.md` or `plans/backlog.md` with source evidence.
- Follow-up: Add self-improvement candidate extraction and eval-run artifacts.

## Resource manager does not yet cover full Pi package lifecycle

- Issue: `resource_install` supports workspace skills, prompts, single-file extensions, and local directory packages, but not full npm/git package installation, pinning, updating, filtering, or trust metadata.
- Affected area: `.pi/extensions/resource-install.ts`, `.pi/extensions/lib/resource-install.ts`, the Resources panel, and Pi package governance.
- Symptoms: Chat-driven resource installation is useful for workspace resources but narrower than Pi's package ecosystem.
- Current status: Staged-by-default executable resource behavior is safer than automatic activation.
- Workaround: Use `.pi/settings.json` and normal package workflows for advanced package cases until Fleet Pi grows a package manager surface.
- Follow-up: Add package listing, pinning, activation policy, and package diagnostics.

## Reasoning controls are only partially surfaced

- Issue: Fleet Pi exposes model and thinking level, but richer Pi reasoning/session settings are not yet surfaced as first-class UI/API controls.
- Affected area: settings schema, Configurations panel, Pi runtime creation, and run provenance.
- Symptoms: Mode/task-specific reasoning presets and branch/compaction summary controls require code/config changes instead of UI-driven management.
- Current status: Default provider/model/thinking settings are available through `.pi/settings.json`.
- Workaround: Adjust supported `.pi/settings.json` fields manually or through existing configuration controls.
- Follow-up: Add support for thinking budgets, branch summaries, and reasoning presets by mode/task.

## autocontext_judge requires Anthropic API key, not Bedrock

- Issue: The `autocontext_judge` and `autocontext_improve` tools make direct calls to the Anthropic API and require an `ANTHROPIC_API_KEY` environment variable. Fleet Pi's primary provider is Amazon Bedrock; no Anthropic API key is configured.
- Affected area: `pi-autocontext` package, `autocontext_judge`, `autocontext_improve`, `autocontext_queue` tools.
- Symptoms: All `autocontext_judge` calls fail with `Anthropic API error 401: invalid x-api-key`. The memory-recall eval rubric cannot be executed automatically.
- Current status: Manual rubric scoring is used as a workaround. Rubric was validated manually against three test cases; it discriminates correctly (scores: 1.0, 0.59, 0.0 for strong/mediocre/hallucinating responses).
- Workaround: Score manually against `agent-workspace/evals/memory-recall.md`. The four-dimension weighted formula produces valid results without the LLM judge.
- Follow-up: Either configure `ANTHROPIC_API_KEY` in the environment, or check whether `pi-autocontext` supports a custom provider/model override for judging (e.g., via Bedrock). Add to `.env.example` if an Anthropic key is required.

## pi-autocontext package has a module resolution error

- Issue: `autocontext_scenarios` fails with `Cannot find module './parsers/any.js'` inside the `zod-to-json-schema` dependency of `pi-autocontext`.
- Affected area: `pi-autocontext` package, `autocontext_scenarios`, `autocontext_queue` tools.
- Symptoms: Cannot list registered scenarios or queue background evaluation tasks.
- Current status: The `autocontext_judge` tool is separately blocked by the Anthropic auth issue. Formal scenario registration is unavailable.
- Workaround: Use `autocontext_judge` directly (when auth is resolved) with the rubric from `agent-workspace/evals/memory-recall.md`. Document the scenario spec as a plain Markdown artifact instead.
- Follow-up: Update `pi-autocontext` package or pin `zod-to-json-schema` to a version that includes `parsers/any.js`.
