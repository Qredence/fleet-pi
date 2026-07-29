# Plan: Upgrade Pi SDK to 0.82.1 — COMPLETE

## Goal

Align Fleet Pi on `@earendil-works/pi-coding-agent` **0.82.1** (with matching `pi-ai`,
`pi-agent-core`, and `pi-tui` pins) without breaking chat, BYOK, or session runtime.

## Status: COMPLETE

Pins updated in root `package.json` and `apps/web/package.json`; lockfile refreshed.
No `authStorage` migration was required — runtime already uses `services.modelRuntime`
(`setRuntimeApiKey`, `removeRuntimeApiKey`, `hasConfiguredAuth`, `registerProvider`,
`unregisterProvider`).

Validation:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm syncpack`

## Notes

- Thinking level `"max"` was already present in protocol and settings before the bump.
- Wiki/pitch version strings may lag; `AGENTS.md` and `CHANGELOG.md` were updated.
