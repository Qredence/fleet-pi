# DiscreteTabs match header pill chrome

Written against: 8bab2b9

## Evidence chain

- Surface: Chat shell header right cluster — `ChromePillButton` (account, sessions, new session) beside `DiscreteTabs` (Pi Resources, Workspace, Artifacts)
- Problem: Header pills and DiscreteTabs sit in the same row but render different chrome: pills are 36px with 1px border and backdrop-blur; tabs are 30px, borderless, no blur.
- Design evidence: `tokens.ts` L20 — "Inline right-panel DiscreteTabs — matches header pill chrome"; `CHROME_PILL_CLASS` defines h-9, border, shadow-sm, backdrop-blur; browser computed styles — pills height 36px / borderTopWidth 1px / backdropFilter blur(8px); tabs height 30px / borderTopWidth 0px / backdropFilter none.
- Owner: `packages/hax-design/src/components/fleet-pi/primitives/discrete-tab.tsx`, `styles/tokens.ts`
- Scope and affected surfaces: `discrete-tab.tsx`, `tokens.ts` (`DISCRETE_TAB_*` if needed); consumers: `right-panel-launcher.tsx`
- Uncertainty: none

## Design decision

Compose DiscreteTab triggers with the full `CHROME_PILL_CLASS` shell (height, border, shadow-sm, backdrop-blur) while retaining `DISCRETE_TAB_INACTIVE_CLASS` / `DISCRETE_TAB_ACTIVE_CLASS` fill and text states and existing label-expansion behavior.

## Reuse

- `CHROME_PILL_CLASS` — `packages/hax-design/src/components/fleet-pi/styles/tokens.ts` L12–13
- `CHROME_PILL_INACTIVE_CLASS` / `CHROME_PILL_ACTIVE_CLASS` — already aliased into `DISCRETE_TAB_*`
- `ChromePillButton` — exemplar consumer of full pill shell
- Exemplar: `packages/hax-design/src/components/fleet-pi/primitives/chrome-pill.tsx`

## Changes

1. `packages/hax-design/src/components/fleet-pi/primitives/discrete-tab.tsx`
   - Change: Import `CHROME_PILL_CLASS` from `../styles/tokens`.
   - Change: Add `CHROME_PILL_CLASS` to `discreteTabTriggerVariants` base string (or merge via `cn` on the trigger) so every tab gets h-9, border-border/70, shadow-sm, backdrop-blur.
   - Change: Remove conflicting height/padding from size variant if it prevents h-9 — adjust `default` size to align with pill px-3 while preserving 12px text and 14px icons.
   - Change: Deduplicate shadow if `CHROME_PILL_CLASS` shadow-sm plus `data-[state=*]:shadow-sm` on `DISCRETE_TAB_*` double-applies; keep one shadow source.
   - Preserve: `discrete-tab.css` label expansion; inactive tooltip; keyboard arrow navigation; `rounded-full`.
   - Verify: Computed height 36px, border 1px, backdrop-blur on tab triggers.

2. `packages/hax-design/src/components/fleet-pi/styles/tokens.ts` (only if needed after step 1)
   - Change: If shadow duplication remains, trim `data-[state=inactive]:shadow-sm` / `data-[state=active]:shadow-sm` from `DISCRETE_TAB_*` when base already includes `shadow-sm`.
   - Preserve: Quiet Chrome inactive/active fill colors (`bg-sidebar` / `bg-background`).
   - Verify: Token comment "matches header pill chrome" is true at runtime.

## Scope

- Inherit: Header right-panel `DiscreteTabs` launcher
- Verify: Any other `DiscreteTabs` consumer still renders correctly with h-9 shell
- Exclude: Changing DESIGN.md Discrete Tabs accent spec to `bg-accent`; InputBar mode/model chip styling; hiding mobile launcher per DESIGN.md L245

## Validation

- Product: Load `/` — header pills and DiscreteTabs read as one chrome family (same height, border, blur).
- Interface: Active tab label still expands; inactive tooltip still shows; dark and light themes.
- System: `ChromePillButton` unchanged; no parallel pill token introduced.
- Repository: `pnpm --filter @workspace/hax-design typecheck` → pass

## Stop conditions

- Stop if label expansion or badge layout breaks at h-9 — adjust padding only, do not drop border/blur shell.

## Design documentation

- After acceptance and validation: Note in `DESIGN.md` § Discrete Tabs that implemented tabs follow Quiet Chrome / `CHROME_PILL_*` (not the older accent-only inactive/active spec at L218–219) to resolve doc drift.
