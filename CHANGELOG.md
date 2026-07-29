# Changelog

All notable changes to Fleet Pi are documented here. This file follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); tagged releases are
also published as `RELEASE_NOTES_v*.md` at the repo root.

## [Unreleased] — `feat/chat-protocol-hardening`

Hardens the chat wire contract, BYOK provider credential scrubbing, and hot-path
performance in `@workspace/pi-protocol` and the web chat runtime, with a
maintainability refactor of the Zod schema surface. Public API is unchanged.

### Added

- **`userId` / `userEmail` on `ChatRequestSchema`** — the Zod schema now matches
  the server-injected `ChatRequest` type, and both fields surface in the
  regenerated `apps/web/openapi.json`.
- **NDJSON error frame on chat stream failure** — `post-chat.ts` enqueues a
  `{ type: "error", message }` event before closing the stream when a turn
  throws, so clients are notified instead of seeing a silent close.
- **`provider-catalog.test.ts` integrity test** — encodes the Pi `pi-ai` env-var
  map and asserts `PROVIDER_ENV_SCRUB_VAR_NAMES` covers every known provider's
  env credentials with no duplicates, so the scrub list can't drift from Pi.
- **Source-linked JSDoc** across protocol, model-pattern, and provider-catalog
  public APIs.

### Changed

- **Split `chat-protocol.zod.ts` into `schemas/` modules** (`shared`, `settings`,
  `chat`, `catalog`, `misc`, `z`) re-exported through the existing entry point.
  A single patched zod instance (`schemas/z.ts`) is threaded through all
  fragments so `zod-to-openapi` `.openapi()` metadata is preserved; the public
  facade uses explicit named exports and does not leak the internal patched `z`.

### Performance

- **Cached compiled glob regexes in `model-patterns.ts`** — a bounded map (500
  entries) avoids recompiling the same glob on every model match.
- **Cached the parsed CORS allowlist in the chat-runtime `router.ts`** — the
  allowlist is re-parsed only when `FLEET_PI_CHAT_RUNTIME_CORS_ORIGINS` changes
  (source-keyed invalidation), instead of on every request.

### Fixed

- **Rejected CORS origins are now logged** — `applyCors` warns with the rejected
  origin and allowlist size, easing diagnosis of cross-origin chat failures.
- **`DAYTONA_TARGET` added to the Vercel env scrub list** — caught by the new
  integrity test; it is an infra config var (not a secret) but is scrubbed for
  consistency with the other `DAYTONA_*` vars.

### Removed

- **Obsolete `.qoder/repowiki` knowledge base** — deleted the stale generated
  wiki tree (part of clearing pre-existing working-tree leftovers in `37634c4`).

### Chore

- **Thermos remediation** — restored husky pre-commit to `pnpm exec lint-staged`
  only (removed package test runs from the hook); reverted `.circleci/config.yml`
  to the `origin/main` say-hello stub; removed `docs/test-automation.md`,
  `docs/test-automation-summary.md`, and `scripts/test-precommit-hooks.sh`.
  Reverted `.pi/settings.json` local churn from the prior chore commit.

### Verification

- Workspace typecheck across 3 packages, `pi-protocol` tests 8/8, web tests
  561/561, OpenAPI regenerated and diff-reviewed.
