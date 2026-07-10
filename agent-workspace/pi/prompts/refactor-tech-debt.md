---
description: Identify, categorize, and draft an issue list or execution plan for technical debt in the current workspace.
argument-hint: "[scope-path]"
---

Rationale: Repeatable slash-command for scoped tech-debt inventories before refactors.

You are an expert software architect tasked with identifying, analyzing, and documenting technical debt and refactoring opportunities in this codebase.

Scope of Audit: ${1:-.}

Please perform a thorough investigation of the specified scope. Use `workspace_index`, `project_inventory`, and your search, find, and read tools as necessary.

### Investigation Phase:

1. Run `pnpm tech-debt` from the repo root when available; supplement with targeted search.
2. Scan the codebase within the target scope for:
   - Specific tech-debt markers like `TODO`, `FIXME`, `HACK`, `DEPRECATED`, `STUB`, or `XXX`.
   - Structural design smells, tight coupling, and violations of modular separation (e.g., UI code calling APIs directly without abstractions).
   - Code duplication or boilerplate.
   - Areas mentioned in `agent-workspace/memory/project/known-issues.md` or `open-questions.md`.

3. Categorize all identified issues into a structured format:
   - **Severe/Critical**: Issues affecting type safety, system stability, performance bottlenecks, or security.
   - **Medium/Maintenance**: Sub-optimal design patterns, moderate code duplication, tight coupling, or missing tests.
   - **Low/Cosmetic**: Outdated documentation, formatting, minor styling inconsistencies, or dead comments.

### Deliverable:

Produce a comprehensive Tech Debt Report with:

- **Overview**: High-level summary of the codebase quality and risk profile.
- **Detailed Inventory**: A table list of findings (File, Location, Classification, Description, and Impact).
- **Refactoring Strategy**: A step-by-step roadmap/execution plan to resolve the high-priority technical debt incrementally. Ensure it respects workspace-native conventions and minimal diff principles.
