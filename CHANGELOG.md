# Changelog

All notable changes to Fleet Pi are documented here. This file follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Historical notes for
0.5.x live under `docs/releases/`.

## [Unreleased]

Hosted Agent turns on Cloudflare stream from the signed-in user's Pi Durable
object (`@earendil-works/pi-durable` 1.2.0 on `@earendil-works/pi-coding-agent`
1.1). That object's SQLite storage is the transcript. Neon keeps auth, settings,
and an optional projection. The Daytona volume holds the harness and artifacts.

### Added

- **Hosted transcript is the Durable Object** — new Cloudflare `/api/chat`
  sessions address `USER_PI_DURABLE`. Legacy JSONL sessions can still use the
  Neon Function. Session JSONL is no longer copied to object storage.

### Removed

- **Session blob client** — `object-storage.ts` and `session-blob-store.ts` are
  gone, along with `@aws-sdk/client-s3`. `neon.ts` declares no buckets.
  `wrangler.jsonc` has no R2 binding.

## [Unreleased — prior notes]

Hardens the chat wire contract, BYOK provider credential scrubbing, and hot-path
performance in `@workspace/pi-protocol` and the web chat runtime, with a
maintainability refactor of the Zod schema surface. Public API is unchanged.

Adds one SQLite Durable Object per signed-in user as the Pi Durable storage
owner, and opens a Pi Durable harness on that storage.

### Added

- **One SQLite Durable Object per user (CF-002)** — `apps/web` binds
  `UserPiDurable` as `USER_PI_DURABLE` and opens that user's Pi Durable SQLite
  storage with `openDurableObjectSqliteStorage` (`@earendil-works/pi-durable`
  1.2.0). The same user id resolves to one object id. The object does not
  construct an `AgentSession`. The namespace is provisioned on the next
  production deploy.
- **Pi Durable harness on that object (DURABLE-001, DURABLE-002, DURABLE-003,
  DURABLE-004)** — the object calls `Harness.open` on the storage it already
  opened. Read and search are replay-safe; write, edit, and bash omit replay.
  A scripted bash echo survives a second open of the same storage, a killed
  read runs again once, and a killed bash stays interrupted. Protected
  workspace paths stay blocked. `POST /api/chat/durable-spike` addresses the
  signed-in user's object. Without sandbox tools the same route still accepts
  a model-only reply. New hosted `/api/chat` turns use the same object.
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

- **Deployment split (CF-015)** — `docs/wiki/deployment.md` labels the Neon
  Function chat stream interim. The spike turn stays on `UserPiDurable`, not
  on a longer Worker request.
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
- Phase C: `pnpm --filter web typecheck`, `pnpm knip`, node and Workers
  tests for the same root id, read replay, interrupted bash, scripted echo,
  and model-only tool list, and `pnpm build:cloudflare` (the built worker
  exports `UserPiDurable`). Production `/api/chat` still uses
  `createAgentSessionServices`.
