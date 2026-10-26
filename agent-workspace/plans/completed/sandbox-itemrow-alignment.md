# Sandbox Settings ItemRow alignment

Written against: 8bab2b9

## Evidence chain

- Surface: Settings dialog → Sandbox tab (`/` → Account menu → Settings → Sandbox)
- Problem: Sandbox uses nested `ConfigurationSection` + `SectionSurface elevation="raised"` + inner bordered card, Active/Missing badges, duplicate Cancel controls, and footer label "Save Settings" — visually and structurally unlike the Providers tab beside it in the same dialog.
- Design evidence: AGENTS.md — Settings uses flat `ItemRow` lists without nested `SectionSurface`; DESIGN.md L271 — don't nest cards in configuration lists; browser inspection (Jul 2026) — Sandbox shows raised card + badge chrome while Providers shows flat search + ItemRow + Update.
- Owner: `packages/hax-design/src/components/fleet-pi/pi/config-panel/sections/sandbox-provider-section.tsx`
- Scope and affected surfaces: `sandbox-provider-section.tsx`, `settings-dialog.tsx` (Sandbox tab mount only)
- Uncertainty: none

## Design decision

Rebuild Sandbox credential UI on the Providers exemplar: one `SettingsPane`, one `ItemRow` for Daytona, inline `RowSurface` editor, row-trailing Cancel while editing, footer Save only. Remove nested section/card chrome and badge-based status presentation.

## Reuse

- `ItemRow` — `packages/hax-design/src/components/fleet-pi/primitives/item-row.tsx`
- `RowSurface` / `fleetPiRowSurface` — `packages/hax-design/src/components/fleet-pi/primitives/surface.tsx`, `styles/tokens.ts`
- `SettingsPane` — `packages/hax-design/src/components/fleet-pi/primitives/settings-pane.tsx`
- `InputGroup` / `InputGroupInput` — same field pattern as Providers inline editor
- Exemplar: `packages/hax-design/src/components/fleet-pi/pi/config-panel/sections/provider-credentials-section.tsx` (ItemRow + RowSurface inset expansion, L226–331)

## Changes

1. `packages/hax-design/src/components/fleet-pi/pi/config-panel/sections/sandbox-provider-section.tsx`
   - Change: Replace `ConfigurationSection` + `SectionSurface elevation="raised"` + nested `rounded-[10px] border …` card with `SettingsPane title="Sandbox" description="Configure isolated execution environments."` wrapping a single Daytona `ItemRow`.
   - Change: ItemRow icon = `HardDrive` or `ProviderBrandIcon` for `daytona` if available; title = "Daytona"; subtitle = `DAYTONA_API_KEY · DAYTONA_TARGET` (env var names, no Active/Missing badge).
   - Change: Trailing control = ghost `Update` / `Cancel` toggle (same as Providers L242–256); expanded editor = `RowSurface tone="inset"` with API key + Region/Target fields using `InputGroup` (not raw `Input` + custom labels).
   - Change: Footer of expanded editor = single `Save` button only; remove footer `Cancel`; rename "Save Settings" → "Save".
   - Preserve: Sequential `onUpdateProvider` calls for `daytona` and `daytona-target`; toast success/error; loading state.
   - Verify: No `SectionSurface`, no nested card, no `Badge` Active/Missing; editing shows one Cancel on row and one Save in footer.

2. `packages/hax-design/src/components/fleet-pi/pi/settings-dialog.tsx`
   - Change: Remove outer Sandbox wrapper `h3` + description block (L507–514); mount `SandboxProviderSection` directly like Providers (L524–530).
   - Preserve: `activeTab === "sandbox"` branch and provider props wiring.
   - Verify: Sandbox tab shows one title via `SettingsPane` inside section; breadcrumb still reads "Sandbox".

## Scope

- Inherit: Settings dialog Sandbox tab only
- Verify: Providers tab unchanged; Daytona save behavior unchanged
- Exclude: Settings breadcrumb dedup, mobile tab token alignment, global Save vs Commit label unification across other tabs

## Validation

- Product: Open Settings → Sandbox; configure or update Daytona credentials; confirm save still works.
- Interface: Compare Sandbox vs Providers side by side — same list density, same expand/collapse pattern, same Save label.
- System: No new card primitive; no `SectionSurface` in Sandbox path.
- Repository: `pnpm --filter @workspace/hax-design typecheck` → pass

## Stop conditions

- Stop if Daytona requires a multi-row list (more than one sandbox provider) — reassess whether multiple `ItemRow` entries suffice without reintroducing `SectionSurface`.

## Design documentation

- After acceptance and validation: none required beyond this plan.
