# Agent Workspace

`agent-workspace/` is the repo-local agent workspace for Fleet Pi. It holds the
agent-facing memory, policies, plans, skills, runtime resources, artifacts, and
scratch files that support Fleet Pi as a self-improving coding environment.

This directory is distinct from the normal human-facing docs:

- `docs/` is for project documentation written for people.
- `agent-workspace/` is for agent-facing operational context and
  self-improvement state.
- `agent-workspace/pi/` is the canonical home for Pi skills, prompts,
  extensions, and package bundles installed through the chat. Root
  `.pi/settings.json` remains only the compatibility bridge that loads them.

Important self-improvements should happen as normal, reviewable repository
diffs. Durable memory, policy updates, workflow changes, and workspace-installed
Pi resources should stay visible in version control rather than being hidden in
transient state.

For the human-facing overview, see [../docs/agent-workspace.md](../docs/agent-workspace.md).
