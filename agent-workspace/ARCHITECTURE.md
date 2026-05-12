# Agent Workspace Architecture

This document describes the structural design, layering model, and evolution
mechanisms of Fleet Pi's `agent-workspace/`. Read this when performing
architecture work, self-improvement, or harness-mode operations.

---

## Layering Model

Each layer builds on the one above. Higher layers are more stable; lower layers
change more frequently.

```
system/       Identity, constraints, policies         (protected — rarely changes)
    ↓
memory/       Project knowledge, decisions            (rationale required)
    ↓
skills/       Reusable procedures and workflows       (rationale required)
    ↓
plans/        Active work, backlog, completed plans   (rationale required)
    ↓
pi/           Chat-installed runtime resources        (mutable with synthesis)
    ↓
artifacts/    Reports, traces, generated outputs      (freely mutable)
    ↓
scratch/      Ephemeral temporary files               (freely mutable)
```

---

## Mutation Tiers

| Tier               | Paths                                                                                     | Rule                                            |
| ------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Free               | `scratch/**`, `artifacts/**`, `memory/daily/**`                                           | Write without explanation                       |
| Rationale required | `memory/project/**`, `memory/research/**`, `memory/summaries/**`, `plans/**`, `skills/**` | Include synthesis or justification              |
| Protected          | `system/**`, `evals/**`                                                                   | Requires explicit user override or harness mode |

---

## Evolution Mechanisms

### Memory Accumulation

Project knowledge lives in `memory/project/*.md` (architecture, decisions,
preferences, open-questions, known-issues). Normal "remember this" requests go
to the narrowest canonical file. Research material goes to `memory/research/`.

### Skill Growth

Skills are procedures that grow from experience. Each lives in
`skills/<name>/SKILL.md` with optional supporting files (changelog.md,
evals.md, examples.md). After complex tasks, capture reusable procedures as
workspace skills.

### Plans as First-Class Artifacts

Plans are versioned and reviewable: `plans/active/` for current work,
`plans/completed/` for finished plans with outcomes, `plans/abandoned/` for
suspended work with rationale, `plans/backlog.md` for future work.

### Self-Improvement Loop

All self-modifications appear as reviewable repository diffs. The governance
protocol (system/self-improvement-policy.md) requires answering: what triggered
it, what changed, how future agents benefit, how it can be evaluated.

### Doc-Gardening (Curator Pattern)

Background maintenance keeps knowledge fresh: identify stale documentation,
consolidate redundant entries, archive unused skills, update quality grades.

---

## Pi Integration Model

```
.pi/settings.json              Compatibility bridge — points at workspace resources
.pi/extensions/                Executable runtime bridges (bedrock-auth, resource-install, etc.)
agent-workspace/pi/skills/     Chat-installed Pi skills
agent-workspace/pi/prompts/    Chat-installed Pi prompts
agent-workspace/pi/extensions/ Staged and enabled extensions
agent-workspace/pi/packages/   Package bundles
```

- `.pi/settings.json` is the bridge — it makes workspace resources loadable by Pi
- Extensions and packages are **staged by default** — explicit user activation required
- Skills and prompts become usable after reload or new session
- Use `resource_install` for chat-driven resource installation

---

## Relationship to Root AGENTS.md

The root `/AGENTS.md` covers the **full repository** — build commands, architecture
notes, code conventions, deployment, CI. It is auto-discovered by the Pi SDK.

This `agent-workspace/AGENTS.md` covers the **workspace backbone** — constraints,
navigation, self-improvement protocol, mode boundaries. It is loaded by the
`workspace-context` extension and injected into agent context on every turn.

The two complement each other: root AGENTS.md for "how to work in this repo",
workspace AGENTS.md for "how to operate as an evolving agent."

---

## Design Principles

| Principle                                   | Implication                                                         |
| ------------------------------------------- | ------------------------------------------------------------------- |
| Durable > hidden state                      | All learnings, plans, and decisions are version-controlled markdown |
| Narrow canonical files > ad hoc docs        | Write to the smallest file that matches the purpose                 |
| Discoverable resources > buried context     | Everything reachable from the navigation map                        |
| Reviewable diffs > opaque self-modification | Self-improvement is auditable and reversible                        |
| Progressive disclosure > context flooding   | Inject the map; navigate to depth on demand                         |
| Enforce invariants, not implementations     | Boundaries are strict; methods within are flexible                  |

---

## Structural Invariants

These hold true regardless of workspace evolution:

1. `system/` files define who the agent is and what it cannot do
2. `memory/project/` is the canonical recall surface for project knowledge
3. `plans/active/` always reflects current work state
4. `manifest.json` is the canonical section registry
5. `AGENTS.md` is the always-injected operating context
6. Scratch space is ephemeral — never depend on it persisting
7. Indexes are projections — regenerable, never canonical
