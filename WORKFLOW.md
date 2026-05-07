---
tracker:
  kind: linear
  endpoint: https://api.linear.app/graphql
  project_slug: "7c8589daab4e"
  api_key: $LINEAR_API_KEY
  active_states:
    - Todo
    - In Progress
  terminal_states:
    - Done
    - Closed
    - Cancelled
    - Canceled
    - Duplicate
polling:
  interval_ms: 30000
workspace:
  root: ~/code/symphony-workspaces/fleet-pi
hooks:
  after_create: |
    zsh /Volumes/SSD-T7/work-location/fleet-pi/fleet-pi/scripts/symphony/after-create-worktree.zsh
  before_run: |
    zsh /Volumes/SSD-T7/work-location/fleet-pi/fleet-pi/scripts/symphony/before-run-bootstrap.zsh
  after_run: |
    zsh /Volumes/SSD-T7/work-location/fleet-pi/fleet-pi/scripts/symphony/after-run-status.zsh
  before_remove: |
    zsh /Volumes/SSD-T7/work-location/fleet-pi/fleet-pi/scripts/symphony/before-remove-worktree.zsh
  timeout_ms: 60000
agent:
  max_concurrent_agents: 2
  max_turns: 20
  max_retry_backoff_ms: 300000
  max_concurrent_agents_by_state:
    todo: 1
    in progress: 2
codex:
  command: zsh /Volumes/SSD-T7/work-location/fleet-pi/fleet-pi/scripts/symphony/codex-app-server.zsh
  approval_policy: never
  thread_sandbox: workspace-write
  turn_sandbox_policy:
    type: workspaceWrite
  turn_timeout_ms: 3600000
  read_timeout_ms: 5000
  stall_timeout_ms: 300000
---

You are working on Linear issue {{ issue.identifier }} in the Fleet Pi project.

{% if attempt %}
This is retry or continuation attempt {{ attempt }}. Inspect the existing
workspace before changing files.
{% endif %}

Project intent:

- Fleet Pi is a Pi-backed coding-agent product with a browser surface.
- Agent tools must stay scoped to the active project root.
- `agent-workspace/` remains the read-only workspace surface for identity,
  memory, research, skills, and artifacts.
- Codex multi-agent v2 is an additive operator workflow under
  `packages/codex-v2`; it must not replace the Pi-backed browser chat runtime.
- Plan mode stays inside the same chat flow and must remain read-only until the
  user explicitly chooses execution.

Execution rules:

- Respect the repo's `AGENTS.md` instructions before making changes.
- For Codex multi-agent v2 work, create a plan with `pnpm codex-v2:plan` and
  require explicit `pnpm codex-v2:execute -- --run-id <run-id>` approval before
  mutating worker dispatch.
- Prefer small, reviewable diffs and keep docs aligned with implementation.
- Run the smallest relevant validation lane before finishing.
- Do not change unrelated files or workflows.

Issue details:

- Title: {{ issue.title }}
- State: {{ issue.state }}
- Priority: {{ issue.priority }}
- URL: {{ issue.url }}

Description:
{{ issue.description | default: "No description provided." }}

Labels:
{% for label in issue.labels %}

- {{ label }}
  {% endfor %}

Blockers:
{% for blocker in issue.blocked_by %}

- {{ blocker.identifier }}: {{ blocker.state }}
  {% endfor %}
