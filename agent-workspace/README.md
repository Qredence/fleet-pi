# Agent Workspace

`agent-workspace/` is the repo-local agent workspace for Fleet Pi. It holds the
agent-facing memory, policies, plans, skills, artifacts, and scratch files that
support Fleet Pi as a self-improving coding environment.

This directory is distinct from the normal human-facing docs:

- `docs/` is for project documentation written for people.
- `agent-workspace/` is for agent-facing operational context and
  self-improvement state.

Important self-improvements should happen as normal, reviewable repository
diffs. Durable memory, policy updates, and workflow changes should stay visible
in version control rather than being hidden in transient state.
