# Explorator Subagent — Design Specification

**Created:** 2026-05-15  
**Status:** Installed as Pi extension `explorator-agent`  
**Registration path:** `agent-workspace/pi/extensions/enabled/explorator-agent.ts` via `globalThis.__pi_subagents` bridge

---

## Purpose

`explorator` is a deep codebase exploration agent. It goes far beyond the `scout`'s fast recon to produce a comprehensive structural map of unfamiliar codebases, systems, APIs, or topics.

| Agent        | Model             | Tools                | Speed  | Depth    |
| ------------ | ----------------- | -------------------- | ------ | -------- |
| `scout`      | claude-haiku-4-5  | read, grep, find, ls | Fast   | Targeted |
| `explorator` | claude-sonnet-4-6 | read, grep, find, ls | Medium | Thorough |

---

## Agent Frontmatter

```markdown
---
name: explorator
description: Deep codebase explorer — systematically maps architecture, data flow, patterns, and integration points
tools: read, grep, find, ls
model: anthropic/claude-sonnet-4-6
---
```

---

## Usage

Single run:

```typescript
subagent({
  agent: "explorator",
  task: "Explore the apps/web/src/lib/pi directory and produce a comprehensive architecture map",
})
```

Parallel with scout:

```typescript
subagent({
  tasks: [
    { agent: "scout", task: "Quick map of auth-related files in apps/web/src" },
    {
      agent: "explorator",
      task: "Deep exploration of apps/web/src/lib/pi — architecture, data flow, patterns",
    },
  ],
})
```

Recon-then-explore chain:

```typescript
subagent({
  chain: [
    {
      agent: "scout",
      task: "Map the top-level structure and identify key modules",
    },
    {
      agent: "explorator",
      task: "Deep exploration of the modules identified in {previous}",
    },
  ],
})
```

---

## Exploration Layers

The agent works through four layers:

1. **Entry & Overview** — README, top-level manifest, root directory structure, main entry files
2. **Architecture Skeleton** — major subsystems, module boundaries, primary data flow, inter-module dependencies
3. **Deep Reads** — full reads of key files, import chain tracing, test-file examination, config/env vars
4. **Patterns & Conventions** — naming, error handling, state management, side-effect isolation, recurring idioms

---

## Output Format

The agent always produces a structured report with these sections:

- `### Entry Points` — key files with one-line purpose
- `### Architecture` — subsystems and connections
- `### Data Flow` — input → transforms → output
- `### Key Abstractions` — important types, interfaces, classes, functions
- `### Patterns & Conventions` — naming, errors, state, side effects
- `### Integration Points` — external APIs, databases, config, env vars
- `### Unknowns & Gaps` — what needs deeper investigation
- `### Exploration Path` — ordered breadcrumb trail of files examined

---

## Registration Mechanism

The agent is registered at extension load time via the `globalThis.__pi_subagents` bridge exposed by the vendored `extensions/vendor/subagents` extension. Load ordering in `settings.json` ensures the bridge is available when the explorator extension initializes:

1. `extensions/vendor/subagents` loads → sets `globalThis.__pi_subagents` (module-level)
2. `extensions/vendor/subagents` default export runs → `agents = loadAgents()` populates built-ins
3. `agent-workspace/pi/extensions/enabled/explorator-agent.ts` default export runs → calls `registerAgent(...)` → pushes to the shared `agents` array

---

## Constraints

- **Read-only tools**: `explorator` only has `read`, `grep`, `find`, `ls` — it cannot mutate files.
- **No subagents**: child agents must not launch their own subagents.
- **Self-contained context**: like all subagents, it receives zero parent conversation history. Include all needed context in the task description.
