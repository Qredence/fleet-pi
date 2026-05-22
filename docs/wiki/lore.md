# Lore

A narrative history of the Fleet Pi codebase.

---

## Era 1 — Foundation (April 2026)

Fleet Pi began with a single initial commit in April 2026. There was no prior codebase to migrate from and no legacy baggage to work around — every line was written fresh.

The first working version delivered a browser-based chat interface that streamed responses from Pi over newline-delimited JSON. The `/api/chat` endpoint was wired to `@earendil-works/pi-coding-agent`, with Amazon Bedrock as the LLM backend. From day one, the chat supported real tool execution: `read`, `write`, `edit`, and `bash` tools scoped to the project root.

**Plan mode** arrived early in Era 1. It introduced a read-only planning tier on top of the normal agent tools — same chat UI, but with unsafe commands blocked and the agent constrained to producing numbered `Plan:` steps before touching any files. Plan mode also brought the first version of the InputBar question bar, which surfaces Pi's `tool-Question` events as inline prompts rather than interrupting the stream.

The **Pi session refactor** followed shortly after. Sessions moved from ephemeral in-memory state to persistent JSONL files, allowing the browser to reconnect to an in-progress session after a page refresh. Session metadata is stored in `localStorage`; the full transcript is hydrated from the JSONL file on load.

Era 1 closed with the **Neon Postgres session mirror** — an optional integration that, when `FLEET_PI_CHAT_DATABASE_URL` is set, mirrors Pi session entries, run events, tool executions, and file mutations into Neon Postgres tables prefixed with `pi_`. The JSONL file remains the source of truth; the mirror is append-only and failures are swallowed so they cannot interrupt chat streaming.

---

## Era 2 — Infrastructure Hardening (April 2026)

With the core chat pipeline working, development turned to the surrounding infrastructure.

**Better Auth** was added to provide first-party authentication. This brought in the standard Better Auth server/client setup, session cookies, and the scaffolding needed for future OAuth provider support.

**Daytona sandbox integration** landed next, enabling Pi to spin up isolated cloud sandbox environments for code execution. This filled a gap left by the initial tool set: bash execution inside the project root is useful for quick checks, but longer-running or potentially destructive operations benefit from a throwaway sandbox.

The UI received two notable additions: an **OpenUI inline renderer** for displaying LLM-generated UI components directly in the chat stream, and a **Lottie spiral loader** to replace a plain spinner during stream initialization.

The testing story matured considerably during Era 2. **Vitest** was added for unit tests and **Playwright** for end-to-end tests, giving the project both fast in-process component tests and full browser automation. A unified **CI pipeline** was configured to run linting, type-checking, unit tests, and e2e tests together.

Developer tooling came in a cluster: **Husky + lint-staged** for pre-commit hooks (Prettier and ESLint on staged files), **knip** to detect unused exports and dependencies, **jscpd** to flag duplicate code, a **tech-debt scanner** to surface TODO/FIXME/HACK markers, and a **devcontainer** configuration so contributors could get a fully configured environment without manual setup.

---

## Era 3 — Dependency Modernization (May 2026)

May 2026 brought a wave of major version bumps across the core toolchain:

- **TypeScript 5 → 6** — the first stable TypeScript 6 release, adopted quickly after it shipped.
- **Vite 7 → 8** — the build toolchain kept pace with the Vite release cadence.
- **ESLint 9 → 10** — the flat config migration was already in place from earlier, making this a relatively smooth upgrade.

These three upgrades happened in close succession, suggesting they were deliberately batched rather than rolled in one at a time.

Era 3 also brought a **memory recall improvement plan** — enriched memory content and prompt-aware retrieval for the agent's long-term memory system in `agent-workspace/`. The **pi-web-access package** was integrated, extending the agent's tool repertoire with `web_search`, `fetch_content`, and `code_search` for research-oriented tasks.

---

## Longest-standing features

The **core chat streaming pipeline** — the `/api/chat` endpoint, the Pi session lifecycle, and plan mode — has been present since the initial commit and has been the stable center of gravity around which everything else was built. It has been refactored (notably the session persistence refactor in Era 1) but never replaced.

---

## Deprecated features

None. The project is young enough that nothing has reached end-of-life yet. The Neon mirror and Daytona integrations are both optional rather than required, but neither has been deprecated.

---

## Growth trajectory

Fleet Pi went from zero to roughly **42,000 lines of TypeScript/TSX** in approximately two months. All primary development was driven by a single contributor, with roughly 14% of commits attributed to an AI bot author (`copilot-swe-agent[bot]`). The pace was fast: foundational architecture, authentication, sandboxing, testing, tooling, and a major dependency modernization all landed within the first eight weeks.
