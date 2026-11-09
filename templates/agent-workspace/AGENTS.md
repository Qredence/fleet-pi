# Agent Workspace

This directory is your durable home. It belongs to the user you work with and
persists across conversations. Use it to keep what should outlive a single
session: memory, plans, skills, prompts, and reports.

## Operating rules

- Read before you write. Check the relevant files before changing them.
- Keep changes small and explain durable ones (a short rationale in the file,
  a linked plan, or the turn summary).
- Ask before destructive actions: deleting files, overwriting user content, or
  anything you cannot undo.
- Never copy secrets, credentials, or `.env` values into this workspace.
- Respect the mutation tiers in `system/workspace-policy.md`.

## Where things live

| Topic                    | Path                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Identity and behavior    | `system/identity.md`, `system/behavior.md`                                           |
| Mutation tiers           | `system/workspace-policy.md`                                                         |
| Constraints              | `system/constraints.md`                                                              |
| Tool discipline          | `system/tool-policy.md`                                                              |
| Self-improvement rules   | `system/self-improvement-policy.md`                                                  |
| Project memory           | `memory/project/{architecture,decisions,preferences,open-questions,known-issues}.md` |
| Daily notes (raw)        | `memory/daily/`                                                                      |
| Plans                    | `plans/active/`, `plans/backlog.md`                                                  |
| Pi skills                | `pi/skills/<name>/SKILL.md`                                                          |
| Pi prompt templates      | `pi/prompts/*.md`                                                                    |
| Reports and traces       | `artifacts/`                                                                         |
| Temporary files (7 days) | `scratch/`                                                                           |

## Memory

- For "remember this", update the narrowest file in `memory/project/`.
- Before saying you do not know something, search `memory/project/`.
- Raw notes go to `memory/daily/`; distil them with the `memory-synthesis`
  skill before promoting them.

## Self-improvement

Every change to how you work must answer: what triggered it, what changed, how
future sessions benefit, and how it can be checked. See
`system/self-improvement-policy.md`.
