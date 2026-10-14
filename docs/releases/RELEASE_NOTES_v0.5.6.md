## What's Changed

Fleet Pi v0.5.6 adds request-scoped structured lifecycle logging to the chat runtime, hardens the PR gate with E2E smoke tests and CODEOWNERS protection for auth/RLS paths, and refreshes security dependency overrides.

### Highlights

- **Structured chat turn lifecycle logging** (#81) — `handleChatTurn` and its route handler now emit pino logs with a request-scoped `requestId` correlating turn start, prompt rejection, abort, error, and teardown events across `server-chat-stream`, `server-runtime`, and `server-shared`. An abort-signal listener leak was fixed, and focused unit tests cover runtime-creation failure, empty-prompt rejection, abort guards, and error emission.
- **E2E smoke tests on every PR** — a new `e2e-smoke` CI job runs Playwright smoke tests on each pull request; the full suite moved to a dedicated `e2e.yml` workflow gated behind the `e2e:full` label and a weekly schedule.
- **CODEOWNERS for security-critical paths** — auth, RLS, trust-zone, session-factory, migration, and auth-script paths now require explicit review before merge.
- **Chat UI polish** — improved `tabs-subtle` accessibility and semantic tokens, updated mode-selector/model-picker patterns, better message-list rendering, and new design tokens for the fleet-pi layout and agent-elements.

### Security

- **Dependency overrides refreshed** (#82) — added or raised minimum versions for `protobufjs` (≥8.6.6), `axios`, `brace-expansion`, `postcss`, `body-parser`, `@hono/node-server`, `js-yaml` (≥5.2.2), `tar` (≥7.5.21), `dompurify` (≥3.4.12), `fast-uri`, and OpenTelemetry packages; `better-auth` bumped to ^1.6.25.
- **pnpm 11 supply-chain hardening** — `minimumReleaseAge` is waived only for a curated list of trusted high-churn packages (extended to `@tabler/*` and `posthog-js`), keeping the minimum-age guard for everything else.

### Breaking changes for forks

- None. The new request logging is additive; existing runtime behavior is unchanged.

### Commit summary

- feat: add structured lifecycle logging and improve chat UI components (09edc3a)
- chore: implement deferred code review improvements (b6e36eb)
- feat(pi): add request-scoped lifecycle logging and error-path tests to handle-chat-turn (3843eae)
- ci: Add E2E smoke tests to PR gate and protect auth/RLS paths (76fe221)
- fix(ci): remove unused runtime examples (6978140)
- codex: fix CI failure on PR #81 (a34e95c)
- Merge pull request #81 from Qredence/feat/chat-turn-lifecycle-logging (52b040e)
- chore: update .gitignore to include .qoder and repowiki directories (c5c0445, a259235)
- chore: refresh Pi dependency overrides (a72a02f)
- docs: align Pi default model reference (5a62594)
- Merge pull request #82 from Qredence/codex/refresh-pi-dependency-overrides (e8c8057)
- chore: waive pnpm 11 minimumReleaseAge for trusted high-churn deps (456aa78)
- chore: extend minimumReleaseAgeExclude for @tabler and posthog-js (cd23185)
- chore: add v0.5.5 release notes (b00872b)

**Full Changelog**: https://github.com/Qredence/fleet-pi/compare/v0.5.5...v0.5.6
