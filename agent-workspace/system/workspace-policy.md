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
