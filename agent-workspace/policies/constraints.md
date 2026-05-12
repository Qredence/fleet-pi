---
name: constraints
description: Self-imposed operating constraints for the Fleet Pi coding agent. Load when orienting to the project, planning significant changes, or any time you need to recall what is and is not allowed.
---

# Agent Constraints

Operating constraints for the Fleet Pi coding agent.

---

## 1. Scope & Mutation Boundaries

- **Stay inside the repo.** All file reads, writes, edits, and bash commands must remain scoped to the project root or `agent-workspace/`. Never traverse outside.
- **Respect mutation tiers.** Free writes: `scratch/`, `artifacts/`, `traces/`, `reports/`, `memory/daily/`. Rationale required: `memory/project/`, `memory/research/`, `memory/summaries/`, `plans/`, `skills/`. Protected (needs `override:true`): `system/`, `evals/`.
- **No lockfile hand-edits.** The root `pnpm-lock.yaml` is canonical. Update it only via `pnpm install`, never by editing manually or creating nested lockfiles.
- **Never edit generated files.** `apps/web/src/routeTree.gen.ts` and similar outputs are owned by their generator. Fix the generator or its inputs, not the output.

---

## 2. Tooling & Commands

- **Use `pnpm` from the repo root** for all dependency and task commands. Prefer `pnpm --filter <workspace> <script>` when only one package is affected.
- **Validate before shipping.** Run the relevant subset of `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` after non-trivial changes. Never declare a task done if these fail.
- **Use `run_experiment` for timed commands**, not raw `bash`, when inside an autoresearch session. Always follow with `log_experiment`.
- **No long-running processes in bootstrap.** The Codex workspace bootstrap is install-only; do not embed servers, watchers, or shell-state-dependent commands there.

---

## 3. Memory & Knowledge

- **Write to the narrowest canonical file.** Normal "remember this" requests go to `agent-workspace/memory/project/{architecture,decisions,preferences,open-questions,known-issues}.md`. Ad hoc files only for explicit user requests, temporary harness tests, or raw synthesis material.
- **Read canonical memory first.** For recall questions, check `agent-workspace/memory/project/` before declaring something unknown. Then `find`/`grep` across `agent-workspace/memory/` before giving up.
- **Log ideas, don't lose them.** Promising-but-deferred autoresearch ideas go in `autoresearch.ideas.md` immediately.
- **ASI is structured memory.** Always populate `asi` in `log_experiment` — at minimum `{"hypothesis": "…"}`. On discard/crash, add `rollback_reason` and `next_action_hint`.

---

## 4. Code Quality

- **Minimal diffs.** Change only what is necessary. Avoid reformatting unrelated code or touching generated outputs.
- **Match the existing style.** Follow the conventions already present in each file — naming, import order, formatting — before reaching for a personal preference.
- **One concern per edit.** Keep commits and PRs focused. Don't bundle unrelated fixes.
- **No hard-coded credentials or secrets.** Bedrock credentials come from standard AWS environment/profile config. Provider credentials belong in Pi auth storage or shell environment, not in source files.
- **No hard-coded model lists.** Model choices must come from `ModelRegistry`/`SettingsManager`, not a hard-coded UI array.

---

## 5. AI & Chat Runtime

- **Plan mode is read-only.** Never add mutating tools (`write`, `edit`, `bash`, research, subagent) to Plan mode's allowlist.
- **Session hygiene.** Invalid, outside, or missing `sessionFile` values must silently start a fresh project-scoped session — never surface an error to the user for this case.
- **Tool execution is project-scoped.** File paths and bash `cwd` for chat-driven tool execution must remain inside the active `projectRoot`.
- **Extensions are staged by default.** Use `resource_install` for Pi resources. Executable extensions and packages require explicit user activation (`activate: true`); skills/prompts become usable after reload/new session.

---

## 6. Communication & Decision-Making

- **Ask before destructive changes.** Before deleting files, dropping database tables, force-pushing branches, or any irreversible action, confirm intent with the user.
- **Surface uncertainty early.** If requirements are ambiguous, use `questionnaire` to clarify before writing code — not after.
- **Prefer parallel tool calls.** Independent reads, fetches, and searches go in a single `function_calls` block. Reserve `subagent` for reasoning-heavy delegation, not simple I/O.
- **Be concise in responses.** Show file paths clearly. Avoid restating what was already said. Let diffs speak.
- **Don't invent optional parameters.** If a tool parameter is optional and the user hasn't specified it, omit it rather than guessing.

---

## 7. Documentation & Public Surface

- **`README.md` is user-facing.** Keep it concise and centered on the recommended standalone path. Do not bloat it with internal details.
- **Fix generators, not outputs.** When `docs/api.md`, `docs/project-structure.md`, or `docs/architecture.md` drift, fix the generator or its source inputs.
- **Run `pnpm validate-agents-md`** after changing AGENTS.md command examples or instructions.
- **Run `pnpm generate:docs`** after changing doc-generation sources.
- **Only update English docs** when syncing docs with code; never touch translated docs under `docs/src/content/docs/ja`, `ko`, or `zh`.

---

## 8. Safety & Ethics

- **No exfiltration.** Never read, transmit, or log secrets, credentials, private keys, or `.env` values beyond what is strictly required for the task at hand.
- **No self-modification of guardrails.** Do not edit this file or `system/` or `evals/` to relax constraints without an explicit override from the user.
- **Respect `workspace-policy.md`.** If a mutation boundary is unclear, read the policy before proceeding; when in doubt, ask.
