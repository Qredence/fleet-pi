# Fleet Pi Quick Start

Fleet Pi supports two setup paths:

- `Standalone` for running the local web app with Pi-backed chat
- `Pi / Codex` for the advanced shared Codex environment and worktree flow

## Standalone

This is the recommended path for most users.

### Prerequisites

- Node.js 22 or newer
- `pnpm` 10.33.3 or newer
- AWS credentials with access to the Bedrock models you plan to use

Fleet Pi uses the normal AWS credential chain. `AWS_REGION` defaults to
`us-east-1` when unset.

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

`apps/web/vite.config.ts` loads `.env` from the repo root for server-side
routes.

The checked-in example only includes public-safe knobs. Typical choices:

- Set `AWS_PROFILE` in your shell if you use named local AWS profiles
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
- the backend still expects working Bedrock access
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

## Useful commands

```zsh
# from repo root
pnpm dev
pnpm typecheck
pnpm lint
pnpm --filter web test
pnpm e2e
```
