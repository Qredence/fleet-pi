# Decisions

Durable project decisions and rationale for Fleet Pi’s Pi-native agent workspace.

## agent-workspace is the durable adaptive layer

- Decision: Treat `agent-workspace/` as Fleet Pi’s persistent agent operating surface, not as incidental storage.
- Status: Active.
- Context: Fleet Pi needs long-term memory, self-improvement artifacts, policies, plans, evals, and runtime resource orientation that survive browser refreshes, process restarts, and individual Pi sessions.
- Rationale: Keeping adaptive state in `agent-workspace/` makes it visible, reviewable, source-controlled, and separate from app product code.
- Consequences: Memory synthesis, backlog curation, eval artifacts, and staged Pi resources should land in `agent-workspace/`; app code should only change when an approved implementation requires it.
- Source: `agent-workspace/AGENTS.md`, `agent-workspace/ARCHITECTURE.md`, `.pi/extensions/workspace-context.ts`.

## .pi remains the Pi compatibility bridge

- Decision: Keep `.pi/settings.json` and trusted `.pi/extensions/*` as runtime bridges while routing workspace-native resources to `agent-workspace/pi/*`.
- Status: Active.
- Context: Pi expects packages, skills, prompts, extensions, provider defaults, model defaults, and thinking settings in Pi-compatible settings.
- Rationale: This preserves native Pi behavior while giving Fleet Pi a durable workspace-native resource layer.
- Consequences: Resource installation tools should update Pi-compatible paths but avoid hiding durable adaptive resources in transient runtime state.
- Source: `.pi/settings.json`, `.pi/extensions/resource-install.ts`, `.pi/extensions/lib/resource-install.ts`.

## Mode boundaries govern autonomy

- Decision: Use Agent mode for coding, Plan mode for read-only reasoning, and Harness mode for workspace/resource management.
- Status: Active.
- Context: Fleet Pi needs self-improvement without uncontrolled app-code mutation or unsafe tool use.
- Rationale: Mode-specific allowlists let the system distinguish normal coding, planning, and durable workspace evolution.
- Consequences: Harness mode is the right place for memory synthesis, backlog curation, staged resource installation, and workspace management; app-code mutation remains approval-sensitive.
- Source: `apps/web/src/lib/pi/plan-mode.ts`, `agent-workspace/AGENTS.md`.

## Memory should be synthesized, not dumped

- Decision: Canonical memory files should contain compact, source-linked durable facts rather than raw transcripts.
- Status: Active.
- Context: Pi sessions and provenance can produce large amounts of raw context, but startup context needs concise recall material.
- Rationale: Small curated memory is easier to trust, search, inject, and evaluate.
- Consequences: Session summaries and raw research should be synthesized into `memory/project/*` only when they are durable and broadly useful.
- Source: `.pi/extensions/lib/workspace-memory-index.ts`, `agent-workspace/evals/memory-quality.md`.
