# Fleet Pi Quick Start

If you want the overall docs map first, start with [docs/README.md](README.md).

Fleet Pi supports two setup paths:

- `Standalone` for running the local web app with Pi-backed chat
- `Pi / Codex` for the advanced shared Codex environment and worktree flow

## Standalone

This is the recommended path for most users.

### Prerequisites

- Node.js 22 or newer
- `pnpm` 10.33.3, matching the pinned `packageManager` field in `package.json`
- A **Google Gemini API key** (`GEMINI_API_KEY`) for the default chat provider

If you already have Corepack available, enable it once so the pinned pnpm
version is used automatically:

```zsh
corepack enable
```

Create a Gemini API key at [Google AI Studio](https://aistudio.google.com/app/apikey)
and set `GEMINI_API_KEY` in your repo-root `.env`. Fleet Pi also loads
`.env.local` (used by the Configurations credentials UI) with `.env.local`
taking precedence over `.env`.

To use **Amazon Bedrock** instead of Gemini, change `defaultProvider` in
`.pi/settings.json` and configure AWS credentials. `AWS_REGION` defaults to
`us-east-1` when unset.

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

The checked-in example only includes public-safe knobs. Typical choices:

- Set `GEMINI_API_KEY` for the default Google Gemini provider (required for chat)
- Set `AWS_PROFILE` in your shell if you use Bedrock instead of Gemini
- Set `AWS_BEARER_TOKEN_BEDROCK` only if your Bedrock setup uses bearer-token
  auth
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

### What "standalone" means here

Standalone does **not** mean "without Pi" or "without an LLM provider."

It means:

- you run Fleet Pi locally as a normal pnpm web app
- the bundled Pi runtime powers chat and tool execution
- the backend expects a working LLM provider (Gemini by default via `GEMINI_API_KEY`)
- you do not need the Codex desktop app or the advanced Codex worktree flow

## Pi / Codex

Use this path if you want Fleet Pi's shared Codex local environment.

- Environment definition: [`.codex/environments/environment.toml`](../.codex/environments/environment.toml)
- Bootstrap script: [`.codex/workspace-bootstrap.zsh`](../.codex/workspace-bootstrap.zsh)
- Advanced setup guide: [docs/codex.md](codex.md)

The current bootstrap is intentionally small and only installs dependencies for
a fresh worktree:

```zsh
# from repo root
pnpm install --frozen-lockfile
```

For the accepted workspace contract and projection boundary, see
[docs/adaptive-workspace.md](adaptive-workspace.md).

## Useful commands

```zsh
# from repo root
pnpm dev
pnpm typecheck
pnpm lint
pnpm --filter web test
pnpm e2e
```

## Next reads

- [Agent Workspace](agent-workspace.md) for the durable workspace model
- [Adaptive Workspace Contract](adaptive-workspace.md) for the canonical
  storage boundary
- [Codex Usage](codex.md) for the advanced Codex worktree path
