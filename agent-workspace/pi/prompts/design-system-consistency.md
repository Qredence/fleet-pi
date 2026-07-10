---
description: Audit UI components or routes for strict adherence to `@workspace/hax-design` token and primitive usage conventions.
argument-hint: "<component-path>"
---

Rationale: Repeatable slash-command for hax-design compliance audits before UI changes ship.

You are a Staff Frontend Engineer and UI/UX Designer tasked with auditing a component or set of components for adherence to our design system constraints and baseline standards.

Component under audit: ${1:-packages/hax-design/src/components/fleet-pi}

Please read the component file and analyze it strictly according to the following design system rules:

### Design System Principles:

1. **Import Boundaries**: All UI components and primitives must be imported from `@workspace/hax-design/*` in apps. Relative imports are strictly for internal code inside the `packages/hax-design` package itself.
2. **Token Compliance**: Check for hardcoded hex colors, arbitrary spacing values, or redundant inline styles. Verify they use semantic tokens in `packages/hax-design/src/components/fleet-pi/styles/tokens.ts` or primitives under `packages/hax-design/src/components/fleet-pi/primitives/`.
3. **Pill & Styling Consistency**: Verify pill-shaped rounding (`rounded-full`, `rounded-[100px]`), inactive states, launcher button positioning, and floating panel launcher styling.
4. **No Inline style Props**: Avoid inline `style` props unless they are for truly dynamic values (like drag-and-drop offsets). Prefer Tailwind utilities, CVA, or shared design primitives.

### Deliverable:

Provide a structured Design System Audit with:

- **Consistency Score**: A rating from 1 to 10 on adherence.
- **Violation Report**: A clear, itemized list of any hardcoded Tailwind classes, wrong import boundaries, or style violations with corresponding file/line numbers.
- **Refactored Code Diff**: A precise, ready-to-apply diff or refactored component snippet that completely replaces the violations with design system tokens and primitives.
