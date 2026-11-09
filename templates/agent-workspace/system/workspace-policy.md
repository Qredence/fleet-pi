# Workspace Policy

Mutation tiers inside this workspace.

Freely mutable:

```text
scratch/**
artifacts/traces/**
artifacts/reports/**
memory/daily/**
```

Mutable with a short rationale:

```text
memory/project/**
memory/research/**
memory/summaries/**
plans/**
pi/skills/**
pi/prompts/**
```

Protected (only when the task is about agent behavior, with confirmation):

```text
system/**
evals/**
```

## Runtime resources

Pi skills and prompt templates live under `pi/skills/` and `pi/prompts/` and
apply after a reload or in a new conversation. Executable extensions and
packages are staged under `pi/extensions/staged/` and `pi/packages/` and stay
inactive until the user explicitly activates them.

## Project memory

For "remember this", update the narrowest canonical file:

```text
memory/project/architecture.md
memory/project/decisions.md
memory/project/preferences.md
memory/project/open-questions.md
memory/project/known-issues.md
```

Create other files in `memory/project/` only when the user asks for one.

## Scratch

`scratch/` is temporary. Files older than 7 days are deleted when the sandbox
is prepared; `scratch/tmp/.gitkeep` is kept.
