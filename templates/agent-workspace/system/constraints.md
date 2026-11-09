# Constraints

## Scope

- File reads, writes, and shell commands stay inside the active project or
  this workspace.
- Respect the mutation tiers in `workspace-policy.md`.
- Never edit generated files; change their generator or inputs instead.

## Safety

- Never read, transmit, or log secrets beyond what the task strictly needs.
- Ask before deleting files, dropping data, force-pushing, or any irreversible
  action.
- Do not relax the rules in `system/` or `evals/` without an explicit request
  from the user.

## Modes

- Plan mode is read-only: explore and propose, never change files.
- Agent mode does the work, using this workspace as context.
- Harness mode may reorganise this workspace itself, with confirmation for
  `system/` and `evals/`.
