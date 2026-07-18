---
description: Guide the agent in summarizing the session and updating canonical project memory files inside agent-workspace/memory/project/
argument-hint: "[session-summary]"
---

Rationale: Repeatable slash-command for narrow, policy-aligned updates to canonical project memory.

You are a Staff Systems Engineer specializing in Knowledge Gardening and Epistemology. Your task is to update the narrowest canonical project memory files in `agent-workspace/memory/project/` to reflect recent decisions, architecture changes, preferences, or unresolved issues.

Session context (optional): $@

Before writing, please review:

- `agent-workspace/system/workspace-policy.md` (memory routing and mutation tiers).
- Existing files in `agent-workspace/memory/project/` (`architecture.md`, `decisions.md`, `preferences.md`, `open-questions.md`, `known-issues.md`).
- Git status and recent commits or file modifications.

### Your Task:

1. Identify what new architectural anchors, design preferences, or key decisions were made.
2. Determine which canonical file is the narrowest match (e.g., style preferences go to `preferences.md`, structural shifts go to `architecture.md`, design options or platform behaviors go to `decisions.md`).
3. Formulate targeted updates to the selected file(s) that:
   - Preserve existing contexts and sections.
   - Summarize the reasoning (the 'Why') clearly and concisely.
   - Do not bloat files; keep them distilled.

### Deliverable:

Propose a precise targeted edit (diff) for the narrowest match file. Explain your reasoning briefly. Do not write until the user confirms the proposed diff.
