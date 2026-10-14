## What's Changed

Fleet Pi v0.5.0 consolidates the shared UI into `@workspace/hax-design`, switches the default LLM provider to Google Gemini, adds optional Neon Postgres session mirroring, and expands agent runtime capabilities with web access tools and improved memory recall.

### Highlights

- **hax-design consolidation** — Renamed `packages/ui` to `packages/hax-design` as the single source of truth for agent-elements, OpenUI, Fleet Pi chat surfaces, shadcn primitives, and shared Pi protocol types. `apps/web` routes are thinner; config panel is split into focused modules.
- **Google Gemini as default provider** — Default model is now `gemini-3.5-flash` via Pi's `google` provider. Extensions receive mode-aware context (`ctx.mode`, `getSystemPromptOptions()`). Bedrock remains available via AWS credentials.
- **Neon Postgres session mirror** — When `FLEET_PI_CHAT_DATABASE_URL` is set, Pi session entries, run events, tool executions, and file mutations mirror into Neon tables prefixed with `pi_`. JSONL remains source of truth; mirror failures never break streaming. Migrations: `pnpm chat:migrate`.
- **Web access tools** — Integrated `pi-web-access` package for `web_search`, `fetch_content`, and `code_search` in Agent mode.
- **Memory recall improvements** — Enriched workspace memory content and prompt-aware retrieval for better long-session context.
- **Question bar UX** — New `usePendingQuestionBar` hook and `suppressQuestionTool` prop on `AgentChat` for cleaner Plan-mode question handling.
- **Security and reliability** — Fixed critical/high security issues and patched vulnerable transitive dependencies.
- **Documentation** — Added comprehensive docs for the UI package, configuration, data models, dependencies, and security posture.

### Breaking changes for forks

- Import path rename: `@workspace/ui` → `@workspace/hax-design` (package directory: `packages/ui` → `packages/hax-design`).
- Default LLM provider changed from Amazon Bedrock to Google Gemini. Set provider/model in `.pi/settings.json` or environment if you need Bedrock.
- New optional env vars for chat mirror: `FLEET_PI_CHAT_DATABASE_URL`, `FLEET_PI_CHAT_MIGRATION_DATABASE_URL` (see [`.env.example`](.env.example)).

### Commit summary

- refactor: consolidate UI in @workspace/hax-design as single source of truth (#44) (c02fc38)
- feat: switch default provider to Google Gemini and add mode-aware extension context (#40) (38c9b1a)
- feat(chat): add Neon Postgres Pi session mirror (#35) (274466d)
- feat: integrate pi-web-access package and enhance web access tools (705cbac)
- feat: implement memory recall improvement plan with enriched content and prompt-aware retrieval (a080f5e)
- feat: implement usePendingQuestionBar hook for managing tool questions (ebefbd4)
- feat: add suppressQuestionTool prop to AgentChat and update related types (584746e)
- feat(docs): add comprehensive documentation for UI package, configuration, data models, dependencies, and security (3fe29bd)
- fix: critical and high security/reliability issues (87c4aee)
- Fix vulnerable transitive dependency overrides (54b8318)
- chore: update generated docs, openapi spec, and e2e tests (19437bc)
- chore: update UI styles in config panel components for improved consistency (10f4ce4)

**Full Changelog**: https://github.com/Qredence/fleet-pi/compare/v0.4.0...v0.5.0
