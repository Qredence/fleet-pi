# Getting started

See also [docs/quickstart.md](../../quickstart.md) for the recommended onboarding path.

## Prerequisites

- Node.js 22+
- pnpm 11.1.3 (`corepack enable`)
- An LLM provider for local chat (Settings BYOK or env vars — see `.env.example`)

Deployed Fleet Pi with Neon Managed Auth uses **Neon AI Gateway** defaults for signed-in users (`qwen35-122b-a10b`, `gpt-oss-120b`).

## Install

```bash
git clone https://github.com/Qredence/fleet-pi.git
cd fleet-pi
corepack enable
pnpm install
cp .env.example .env
```

## Configure (local)

Minimum for local chat — pick one:

```
# OpenAI-compatible BYOK (Settings or env)
OPENAI_CHAT_COMPLETIONS_API_KEY=...
OPENAI_CHAT_COMPLETIONS_BASE_URL=https://...
OPENAI_CHAT_COMPLETIONS_MODEL=...

# Or Google Gemini
GEMINI_API_KEY=...
```

Optional:

```
# Neon Managed Auth (disables anonymous local chat when set)
NEON_AUTH_BASE_URL=...
VITE_NEON_AUTH_URL=...

# Neon AI Gateway (authenticated default on deploy)
NEON_AI_GATEWAY_TOKEN=nt_live_...
NEON_AI_GATEWAY_BASE_URL=https://<branch>-api.ai.<region>.aws.neon.tech

FLEET_PI_CHAT_DATABASE_URL=postgresql://...
DAYTONA_API_KEY=...   # local/dev only; Vercel users need BYOK daytona
```

## Run

```bash
pnpm dev
```

Visit `http://localhost:3000`.

## Verify

1. Send `read package.json` — Read tool card appears.
2. Run `pnpm --version` in Agent mode — Bash card renders.
3. Refresh — transcript hydrates from Pi session metadata.
4. Open Settings — providers/models load; save persists overrides.

## Build & test

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm e2e
pnpm generate:docs
pnpm validate-agents-md
```

## Deploy

See [deployment](../deployment.md) and [deployment release gate](../../runbooks/deployment-release-gate.md).
