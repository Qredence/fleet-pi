# PLANS

## Agent Workspace Foundation

Purpose:
Seed a minimal root `agent-workspace/` that gives Fleet Pi a clean repo-local
substrate for durable memory, plans, skills, evals, artifacts, and reviewable
self-improvement.

Progress:

- [x] Audit the existing `agent-workspace/` scaffold and remove private-note
      remnants that should not survive in the repo.
- [x] Create the requested directory structure and seed concise Markdown files.
- [x] Add a short root `README.md` mention and run lightweight structural
      validation.

Decision Log:

- Keep the first scaffold intentionally small and Markdown-first.
- Extension tools (workspace_index, workspace_write, workspace_context, web_fetch,
  bedrock-bearer-auth) were included in this same change to make the workspace
  immediately useful — the initial plan deferred this, but shipping them together
  avoids a split-context review cycle.

Outcome:

- The root `agent-workspace/` now has a clean index, policies, project-memory
  stubs, research guidance, plan directories, eval checklists, and five
  starter skills (codebase-research, doc-gardening, execution-plan,
  frontend-design, memory-synthesis).
- Private inspiration-note placeholders were removed from the committed
  workspace structure.
- The repo README now briefly points readers to `agent-workspace/` without
  over-documenting it.

## Codex Local Environment

Purpose:
Create a shared Codex local environment for Fleet Pi so new worktree threads can
bootstrap the monorepo consistently.

Progress:

- [x] Audit the current repo tooling, docs, and existing worktree bootstrap
      patterns.
- [x] Add a repo-scoped Codex environment file under `.codex/environments/`.
- [x] Add a small bootstrap script for Codex worktrees.
- [x] Document the setup in repo guidance.

Decision Log:

- Keep Fleet Pi's Codex setup bootstrap-only, matching current OpenAI Codex
  local-environment guidance.
- Reuse the repository's normal `pnpm install --frozen-lockfile` path instead of
  inventing a second dependency bootstrap flow for Codex worktrees.

Outcome:

- Fleet Pi now has a shared Codex local environment at
  `.codex/environments/environment.toml`.
- Codex worktrees bootstrap through `.codex/workspace-bootstrap.zsh`, which
  checks for `node` and `pnpm` and installs dependencies from the repo root.
