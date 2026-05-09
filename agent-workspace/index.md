# Agent Workspace Map

Start here before making broad changes. Use this index to find the smallest
relevant context instead of loading the whole workspace at once.

Fleet Pi treats this directory as the durable agent-facing source of truth for
memory, plans, skills, runtime resources, evals, artifacts, and scratch space.

- System identity and behavior: [system/identity.md](system/identity.md),
  [system/behavior.md](system/behavior.md),
  [system/constraints.md](system/constraints.md),
  [system/tool-policy.md](system/tool-policy.md),
  [system/workspace-policy.md](system/workspace-policy.md),
  [system/self-improvement-policy.md](system/self-improvement-policy.md)
- Project memory: [memory/project/architecture.md](memory/project/architecture.md),
  [memory/project/decisions.md](memory/project/decisions.md),
  [memory/project/preferences.md](memory/project/preferences.md),
  [memory/project/open-questions.md](memory/project/open-questions.md),
  [memory/project/known-issues.md](memory/project/known-issues.md)
- Runtime resources: chat-installed Pi skills, prompts, extensions, and package
  bundles live under [pi/](pi/). Root `.pi/settings.json` is only the
  compatibility bridge that makes these workspace resources loadable by Pi.
- Runtime tools and Pi extensions: discover with `workspace_index` and
  `project_inventory`; executable built-in bridges still live under
  `.pi/extensions/`, while installed resources belong in `agent-workspace/pi/`.
- Active plans: [plans/active/](plans/active/) and
  [plans/backlog.md](plans/backlog.md)
- Skills: [skills/](skills/)
- Evals: [evals/](evals/)
- Artifacts: [artifacts/](artifacts/)
- Scratch space: [scratch/tmp/](scratch/tmp/)

Prefer durable memory and plans over hidden session state. Fleet Pi's agent
identity, skills, tools, memory, extension context, runtime resources, plans,
evals, artifacts, and scratch space should be discoverable from
`agent-workspace/`. Add new durable context in the smallest canonical file that
matches its purpose.

Human-facing explanation: [../docs/agent-workspace.md](../docs/agent-workspace.md)
