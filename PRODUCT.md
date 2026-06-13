# Product

## Register

product

## Users

Solo developers and power users who run Pi coding agents against their own repositories. They are at their machine, in flow, switching between chat, repo inspection, Pi resources, workspace files, and configuration. They expect the UI to stay out of the way while making agent state, plans, and tool output legible and reviewable in Git.

## Product Purpose

Fleet Pi is a local browser workspace for Pi-powered coding agents. It provides a durable, Git-native adaptive layer (`agent-workspace/`), resumable sessions, Agent and Plan modes, and repo-scoped tools with transparent rendering in chat. Success means users trust the shell for daily agent work: fast orientation, clear tool cards, predictable panels, and settings that map to real project files—not opaque cloud state.

## Brand Personality

Approachable · Capable · Focused

The interface should feel like a serious tool that welcomes you in: calm chrome, task-first layout, expert affordances without IDE heaviness. Floating pill controls and quiet side panels over dense toolbars. Competence is shown through clarity and consistency, not decoration.

## Anti-references

- Generic AI SaaS slop: cream/warm-neutral body backgrounds, gradient heroes, identical card grids, side-stripe accent borders, oversized radii on cards, ghost-card border-plus-shadow pairing.
- Heavy IDE chrome: VS Code–clone density, ever-present toolbars, reinvented standard affordances.
- ChatGPT-style minimal bubble chat that hides workspace context, resources, and plan state.

Positive reference direction: Cursor / Linear — floating pills, quiet panels, workflow-first.

## Design Principles

1. **Design serves the workflow** — Every surface exists to support chat, planning, resources, workspace, or configuration; no decorative marketing scaffolding inside the app shell.
2. **Git-native transparency** — UI labels and panels should reinforce that memory, plans, skills, and settings live in reviewable project files.
3. **Earned familiarity** — Reuse shadcn-style primitives and standard patterns (tabs, side panels, command-like selectors) so power users move fast without relearning affordances.
4. **Quiet chrome, loud content** — Header pills and launchers stay subdued (`bg-sidebar` when inactive); tool output, plans, and file previews carry visual weight.
5. **One library, one import path** — All UI lives in `@workspace/hax-design`; apps compose, packages own components, tokens, and Fleet Pi surfaces.

## Accessibility & Inclusion

Target WCAG 2.1 AA for text contrast, focus visibility, and keyboard reachability across chat, panels, and configuration forms. Respect `prefers-reduced-motion` on all transitions. Semantic state colors (error, warning, success) must remain distinguishable without relying on color alone.
