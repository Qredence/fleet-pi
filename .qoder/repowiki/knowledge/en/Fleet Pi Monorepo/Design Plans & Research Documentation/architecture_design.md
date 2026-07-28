Two parallel documentation directories with no executable code:

- `design-plans/` contains feature-level design plans written against a specific commit (e.g. `Written against: 8bab2b9`) following a fixed template: Evidence chain → Design decision → Reuse → Changes → Scope → Validation → Stop conditions → Design documentation. Each plan targets concrete files in `packages/hax-design/src/components/fleet-pi/` and references token classes like `CHROME_PILL_CLASS`.
- `research/` holds exploratory write-ups (e.g. `introducing-fleet-pi.md`) summarizing product capabilities, quickstart commands, prerequisites, and sources consulted.
  The module is purely documentary; it has no build manifest, entry point, or runtime dependency — it serves as the single source of truth for pre-implementation rationale consumed by developers working on the Fleet Pi codebase.
