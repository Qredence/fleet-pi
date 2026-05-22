# Getting started

## Prerequisites

- Node.js 22+
- pnpm 11+ (`npm install -g pnpm`)
- AWS credentials with Bedrock access (for LLM calls)

## Install

```bash
git clone https://github.com/Qredence/fleet-pi.git
cd fleet-pi
pnpm install
```

## Configure environment

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

Minimum required for local use:

```
# AWS credentials for Amazon Bedrock
AWS_REGION=us-east-1
# AWS_PROFILE=your-profile        # if using named profiles
# AWS_BEARER_TOKEN_BEDROCK=...    # if using bearer token auth
```

Optional integrations:

```
# Neon Postgres (enables session mirror + workspace indexing)
FLEET_PI_CHAT_DATABASE_URL=postgresql://...
FLEET_PI_AUTH_DATABASE_URL=postgresql://...  # if separate from chat DB

# Daytona sandboxes (enables per-user isolated execution)
DAYTONA_API_KEY=...
DAYTONA_API_URL=...

# Override the repo root Pi operates inside
FLEET_PI_REPO_ROOT=/path/to/your-repo
```

## Run

```bash
pnpm dev        # starts the web app on http://localhost:3000
```

Visit `http://localhost:3000`. If authentication is configured, log in first.

## Verify

1. Type a message. A streaming response should appear.
2. Ask `read package.json` — a Read tool card should appear with file contents.
3. Ask `run pnpm --version` in Agent mode — a Bash card should render.
4. Refresh the page — the transcript should restore from the Pi session.

## Build

```bash
pnpm build      # builds all packages and the web app
```

The production build outputs to `apps/web/.output/`. Run it with `node apps/web/.output/server/index.mjs`.

## Other commands

```bash
pnpm lint           # ESLint across all workspaces
pnpm typecheck      # tsc --noEmit across all workspaces
pnpm test           # vitest unit tests
pnpm e2e            # Playwright end-to-end tests (requires running dev server)
pnpm format         # Prettier formatting
pnpm knip           # detect unused exports/dependencies
pnpm syncpack       # check dependency version consistency
```

## Auth database migration

If you add `FLEET_PI_AUTH_DATABASE_URL` to switch from SQLite to Neon, run the migration:

```bash
pnpm --filter web auth:migrate
```

For the chat session mirror:

```bash
FLEET_PI_CHAT_MIGRATION_DATABASE_URL=postgresql://... pnpm chat:migrate
```
