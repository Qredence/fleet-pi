# Fleet Pi Quick Start

If you want the overall docs map first, start with [docs/README.md](README.md).

Fleet Pi runs as a standalone local web app with Pi-backed chat.

## Standalone

This is the recommended path for most users.

### Prerequisites

- Node.js 22 or newer
- `pnpm` 11.1.3, matching the pinned `packageManager` field in `package.json`
- An LLM provider for local chat: configure **Settings > Providers** (BYOK) or set
  provider env vars from `.env.example` (for example `OPENAI_CHAT_COMPLETIONS_*`
  or `GEMINI_API_KEY`)

If you already have Corepack available, enable it once so the pinned pnpm
version is used automatically:

```zsh
corepack enable
```

Fleet Pi loads `.env`, then `.env.local` from the repo root (`.env.local` wins).

On **deployed** Fleet Pi with Neon Managed Auth, authenticated chat defaults to
**Neon AI Gateway** models (`qwen35-122b-a10b`, `gpt-oss-120b`) via
`NEON_AI_GATEWAY_*` injected by `neon deploy` when `preview.aiGateway` is enabled
in `neon.ts`. Users can still add BYOK providers in Settings.

`agent-workspace/` is the canonical durable adaptive state. Durable memory,
plans, workspace-installed Pi resources, and other adaptive artifacts belong in
reviewable workspace files; `agent-workspace/indexes/` is reserved for
non-canonical projection data, and `.pi/settings.json` remains the
compatibility bridge.

### 1. Install dependencies

```zsh
# from repo root
pnpm install
```

### 2. Create local configuration

```zsh
# from repo root
cp .env.example .env
```

`apps/web/vite.config.ts` loads `.env`, then `.env.local` from the repo root for
server-side routes (`.env.local` wins).

The checked-in example only includes public-safe knobs. Typical local choices:

- Add an LLM provider in **Settings > Providers** after `pnpm dev`, or
- Set `OPENAI_CHAT_COMPLETIONS_{API_KEY,BASE_URL,MODEL}` in `.env` for OCC BYOK, or
- Set `GEMINI_API_KEY` for Pi's `google` provider
- Leave `PI_AGENT_DIR` unset unless you intentionally want a non-default Pi
  agent resource directory

### 3. Start the app

```zsh
# from repo root
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Smoke check

In a second terminal:

```zsh
# from repo root
curl http://localhost:3000/api/health
```

Expected response:

```json
{ "status": "ok" }
```

Then send a simple prompt like `read package.json` in the chat UI and confirm
that a Read tool card appears.

### Deployed smoke (Neon AI Gateway)

After `pnpm neon:deploy` with Gateway enabled and Managed Auth configured:

1. Sign in on the deployed app.
2. Confirm **Settings > LLM Models** lists `qwen35-122b-a10b` and `gpt-oss-120b`.
3. Send one chat turn on each model and verify the transcript renders.

### What "standalone" means here

Standalone does **not** mean "without Pi" or "without an LLM provider."

It means:

- you run Fleet Pi locally as a normal pnpm web app
- the bundled Pi runtime powers chat and tool execution
- local chat needs a configured provider (Settings BYOK or env); deployed
  authenticated chat uses Neon AI Gateway by default

## Useful commands

```zsh
# from repo root
pnpm dev
pnpm typecheck
pnpm lint
pnpm --filter web test
pnpm e2e
pnpm generate:docs
pnpm validate-agents-md
```

## Next reads

- [Agent Workspace](agent-workspace.md) for the durable workspace model
- [Adaptive Workspace Contract](adaptive-workspace.md) for the canonical
  storage boundary
- [Wiki overview](wiki/overview/index.md) for deeper architecture notes
