# Fleet Pi Workspace Policy

Mutation boundaries inside `agent-workspace/`:

Freely mutable:

```text
scratch/**
artifacts/traces/**
artifacts/reports/**
memory/daily/**
```

Mutable with synthesis or rationale:

```text
memory/summaries/**
plans/**
memory/project/**
memory/research/**
skills/**
pi/skills/**
pi/prompts/**
```

Protected unless the task explicitly concerns agent behavior or workspace
design:

```text
system/**
evals/**
```

Durable changes should include a short rationale in the edited file, a linked
plan, or the surrounding task summary so future agents can understand why the
change was made.

## Agent Home

Fleet Pi's repo-local agent surface lives in `agent-workspace/`. Use it as the
primary home for durable skills, tools context, memory, plans, evals, artifacts,
runtime resources, and scratch space. Built-in runtime Pi extensions remain
executable bridges under `.pi/extensions/`, but chat-installed Pi skills,
prompts, extensions, and package bundles belong under `agent-workspace/pi/`.
Root `.pi/settings.json` should stay as the small compatibility bridge that
points Pi at workspace-native resources.

## Runtime Resource Routing

Use `resource_install` for Pi runtime resources:

```text
pi/skills/**
pi/prompts/**
pi/extensions/staged/**
pi/extensions/enabled/**
pi/packages/**
```

Skills and prompts may be installed into active workspace paths and become
available after a reload or new session. Executable extensions and package
bundles are staged unless the user explicitly asks to activate them. Do not use
`workspace_write` to bypass this routing for runtime resources.

## Project Memory Routing

For normal "remember this" requests, update the narrowest canonical project
memory file:

```text
memory/project/architecture.md
memory/project/decisions.md
memory/project/preferences.md
memory/project/open-questions.md
memory/project/known-issues.md
```

Ad hoc files in `memory/project/` are allowed only when the user explicitly asks
for a separate file, for temporary harness tests, or for large raw material that
will later be synthesized into canonical memory. New sessions should search
canonical project memory first, then fall back to `find`/`grep` across
`agent-workspace/memory/project` before reporting that a memory is missing.

### Memory bullet provenance (v3)

A memory bullet may carry an optional provenance marker at the end of the line:

```text
- User's name is Zachary <!-- pi-memory v=3 id=mem_zac source=user ts=2026-08-10T12:00:00Z -->
```

The marker is an HTML comment, so it stays invisible in rendered Markdown. The
read path parses `id`, `source`, and `ts` from it and shows them in recall. A
bullet without a marker is read as a legacy record with source `unknown`.
Reading never rewrites a file, so legacy bullets keep their exact text.
