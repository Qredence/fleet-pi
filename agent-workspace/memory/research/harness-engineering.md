# Harness Engineering

## Source

OpenAI, "Harness engineering: leveraging Codex in an agent-first world."

## Why it matters for Fleet Pi

Fleet Pi is building an agent-facing coding environment. The article is useful
as inspiration for how repo-local structure, validation, and memory can make
agents more reliable over time.

## Ideas worth adopting

- Repository-local knowledge should be the system of record for durable agent
  context.
- The agent needs a map, not a giant instruction manual.
- Application state, logs, sessions, and UI behavior should become
  agent-legible over time.
- Execution plans should be durable artifacts that can be resumed.
- Architecture and taste should eventually be enforced mechanically where
  practical.
- Entropy requires doc gardening and cleanup workflows.
- Human judgment is more valuable when captured as reusable guidance or checks.

## Ideas not adopted

- No claim that Fleet Pi already provides all of these capabilities.
- No attempt in this initial scaffold to automate enforcement that should first
  exist as clear repo-visible policy.

## Implementation implications

- Keep `agent-workspace/` small, readable, and diff-friendly.
- Use indexed Markdown for durable memory and planning.
- Treat future Pi extensions as the home for workspace indexing, policy
  enforcement, and session inspection.

## Open questions

- Which parts of workspace policy should move from prose into `.pi/extensions/`
  first?
- What validation surface best covers agent-facing UI workflows?

## Last reviewed

2026-05-04
