# Development Workflow

## Prerequisites

- **Node.js ≥ 22** — the `.nvmrc` or the `engines` field in `package.json` reflects this.
- **pnpm 11** — this repo uses pnpm exclusively. Install with `npm install -g pnpm` or via your preferred version manager.
- **AWS credentials** — Fleet Pi drives Amazon Bedrock for AI responses. Standard AWS credential resolution applies (`~/.aws/credentials`, environment variables, or an IAM role). Set `AWS_REGION` (default: `us-east-1`) and optionally `AWS_PROFILE`.

## Initial Setup

```bash
git clone https://github.com/Qredence/fleet-pi.git
cd fleet-pi
pnpm install          # installs all workspaces
cp .env.example .env  # copy environment template; fill in required values
pnpm dev              # starts apps/web on http://localhost:3000
```

Husky hooks are registered automatically during `pnpm install` via the `prepare` script.

## Starting the Development Server

```bash
pnpm dev              # starts all apps via Turborepo (only apps/web today)
```

The web app runs on **port 3000**. Hot module replacement is handled by Vite.

To start only the web workspace:

```bash
pnpm --filter web dev
```

## Workspace-Specific Commands

Run any workspace script from the repo root with `--filter`:

```bash
pnpm --filter web typecheck
pnpm --filter @workspace/hax-design lint
pnpm --filter web test:watch
```

The `web` workspace name comes from `apps/web/package.json` `"name": "web"`. The shared UI library is `@workspace/hax-design`.

## File-Based Routing with TanStack Router

`apps/web/src/routes/` contains every page and API route. TanStack Router generates `apps/web/src/routeTree.gen.ts` automatically when Vite starts or when files change.

**Never edit `routeTree.gen.ts` by hand.** Adding or renaming a file under `apps/web/src/routes/` regenerates it automatically. The root layout lives in `apps/web/src/routes/__root.tsx`.

API routes follow the same file-based pattern. A file at `apps/web/src/routes/api/chat.ts` becomes the `/api/chat` endpoint. Each route exports a `Route` with server handlers for the HTTP methods it supports.

## Adding shadcn Components

shadcn components land in `packages/hax-design`. Always run the add command from the **repo root** targeting the web app so shadcn can resolve the workspace config:

```bash
pnpm dlx shadcn@latest add <component> -c apps/web
```

After the component is added, import it via the `@workspace/hax-design` alias:

```ts
import { Button } from "@workspace/hax-design/components/button"
```

## Writing Tests

- **Unit tests** live colocated with the code they test, named `*.test.ts` or `*.spec.ts`.
- Run all tests: `pnpm test`
- Run tests for one workspace: `pnpm --filter web test`
- Watch mode: `pnpm --filter web test:watch`
- Coverage: `pnpm --filter web test:coverage`

See the [testing guide](./testing.md) for full details on fixtures and mocking.

## Environment Variables

Copy `.env.example` to `.env` in the repo root. The minimum set required to run the app locally:

- `AWS_REGION` — defaults to `us-east-1` if unset.
- `BETTER_AUTH_SECRET` — required when auth is enabled; generate with `openssl rand -base64 32`.

Optional integrations (Daytona, Neon) can be left unset; the app degrades gracefully.

See [reference/configuration.md](../reference/configuration.md) for the full variable list.

## Turborepo Caching

Turborepo caches task outputs. If lint or typecheck results look stale, run with `--force` to bypass the local cache:

```bash
pnpm typecheck -- --force
```

Or clear the Turborepo cache directory (`.turbo/`) manually.
