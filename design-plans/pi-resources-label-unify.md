# Unify Pi Resources panel label

Written against: 8bab2b9

## Evidence chain

- Surface: Chat shell header right launcher + opened right panel (`/` → DiscreteTabs → resources panel)
- Problem: User-facing name disagrees for the same panel: launcher tab visible label is "Resources" while opened panel header reads "Pi Resources".
- Design evidence: AGENTS.md — right panel tab is "Pi Resources"; `right-panel-registry.tsx` L74 `title: "Pi Resources"`; browser inspection — tab `.discrete-tab-label-inner` text "Resources", panel `span.truncate` text "Pi Resources"; tab `aria-label` already "Pi resources".
- Owner: `packages/hax-design/src/components/fleet-pi/pi/right-panel-launcher.tsx` (launcher tab title)
- Scope and affected surfaces: `right-panel-launcher.tsx`, `chat-command-palette.tsx` (command label)
- Uncertainty: none

## Design decision

Set the launcher DiscreteTab visible title to **Pi Resources** so it matches the opened panel header and AGENTS naming. Align command-palette copy to the same string.

## Reuse

- `DiscreteTabs` / `DiscreteTabItem.title` — existing launcher wiring
- Panel title owner — `packages/hax-design/src/components/fleet-pi/layout/right-panel-registry.tsx` (already "Pi Resources")
- Exemplar: Workspace and Artifacts tabs — launcher title matches panel title today

## Changes

1. `packages/hax-design/src/components/fleet-pi/pi/right-panel-launcher.tsx`
   - Change: In `tabs` array, set `title: "Pi Resources"` for id `resources` (was `"Resources"`).
   - Change: Keep `ariaLabel: "Pi resources"` or normalize to `"Pi Resources"` for consistency with visible title.
   - Preserve: Badge count, panel id `resources`, toggle-to-close behavior.
   - Verify: Active tab shows expanded label "Pi Resources"; tooltip shows same when inactive.

2. `packages/hax-design/src/components/fleet-pi/chat-command-palette.tsx`
   - Change: L146 `<span>Open Resources</span>` → `<span>Open Pi Resources</span>` (or equivalent command label).
   - Preserve: Command action wiring to open resources panel.
   - Verify: Command palette search for "pi resources" surfaces the updated label.

## Scope

- Inherit: Header DiscreteTabs launcher, command palette entry
- Verify: Opened panel header unchanged; mobile overlay title unchanged
- Exclude: Renaming panel id `resources`; changing internal API route names; Pi Resources list content

## Validation

- Product: Open chat → click Pi Resources tab → panel header and tab label both read "Pi Resources".
- Interface: Inactive tab tooltip, active expanded label, and panel title are consistent.
- System: `right-panel-registry.tsx` title unchanged.
- Repository: `pnpm --filter @workspace/hax-design typecheck` → pass

## Stop conditions

- Stop if product intentionally wants short "Resources" on chrome and long "Pi Resources" in panel — would require an explicit new naming contract instead of this change.

## Design documentation

- After acceptance and validation: Update `DESIGN.md` Navigation L244 — replace "Resources" with "Pi Resources" in the right-panel DiscreteTabs bullet; remove stale "Configurations" tab reference if still present.
