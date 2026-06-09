# Dependencies

Production dependencies for Fleet Pi, grouped by concern. Version numbers reflect what is pinned in `package.json` at the time of writing; check the root `pnpm-lock.yaml` for exact resolved versions.

---

## Pi AI

The core AI engine powering Fleet Pi.

| Package                           | Description                                                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `@earendil-works/pi-coding-agent` | High-level coding agent with session management, tool routing, plan mode, and Pi resource loading.                      |
| `@earendil-works/pi-ai`           | Core Pi AI abstractions, `ModelRegistry`, provider adapters (including `amazon-bedrock`), and streaming infrastructure. |
| `@earendil-works/pi-agent-core`   | Shared runtime primitives used by both `pi-ai` and `pi-coding-agent`.                                                   |

These packages are proprietary to the Earendil Works ecosystem and are published to npm.

---

## Framework

| Package                  | Description                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `@tanstack/react-start`  | TanStack Start — the full-stack React framework (Vite + Nitro). Provides SSR, file-based routing, and server handlers. |
| `@tanstack/react-router` | Type-safe file-based router. Routes auto-generate into `apps/web/src/routeTree.gen.ts`.                                |
| `@tanstack/react-query`  | Server state management for data fetching, caching, and synchronisation in React.                                      |
| `react`                  | React 19.                                                                                                              |
| `react-dom`              | React DOM renderer.                                                                                                    |
| `vite`                   | Build tool and dev server.                                                                                             |
| `nitro`                  | Server engine used by TanStack Start for SSR and API routes.                                                           |

---

## Authentication

| Package                    | Description                                                                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `better-auth`              | Authentication library. Handles email/password, OAuth (Google), session cookies, and account linking. TanStack Start adapter (`tanstackStartCookies`) integrates with Nitro. |
| `better-sqlite3`           | SQLite driver for the default auth database (`.fleet/auth.sqlite`).                                                                                                          |
| `@neondatabase/serverless` | Neon Postgres driver. Used when `FLEET_PI_AUTH_DATABASE_URL` or `FLEET_PI_CHAT_DATABASE_URL` is set.                                                                         |

---

## UI

| Package                    | Description                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `@workspace/hax-design`    | Workspace-local shared component library. Contains all shadcn components, the `agent-elements` AI chat UI kit, and global styles. |
| `streamdown`               | Streaming markdown renderer with syntax highlighting. Used in `packages/hax-design/src/components/agent-elements/markdown.tsx`.   |
| `motion`                   | Animation library (formerly Framer Motion) used for UI transitions.                                                               |
| `lottie-react`             | Lottie animation renderer used for loading states.                                                                                |
| `@base-ui/react`           | Headless UI primitives (accessible components without built-in styles).                                                           |
| `lucide-react`             | Icon library.                                                                                                                     |
| `@tabler/icons-react`      | Additional icon set.                                                                                                              |
| `recharts`                 | Chart library used for analytics views.                                                                                           |
| `sonner`                   | Toast notification library.                                                                                                       |
| `next-themes`              | Theme provider for Light/Dark/System switching.                                                                                   |
| `cmdk`                     | Command palette primitive.                                                                                                        |
| `class-variance-authority` | Utility for building component variants with Tailwind.                                                                            |
| `tailwind-merge`           | Merges Tailwind classes without conflicts.                                                                                        |

---

## Sandbox (Daytona)

| Package          | Description                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `@daytonaio/sdk` | Daytona TypeScript SDK. Used to provision and manage per-user sandbox workspaces when `DAYTONA_API_KEY` is configured. |

---

## OpenUI

| Package                 | Description                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `@openuidev/react-lang` | OpenUI React renderer. Enables LLM-generated UI definitions to be rendered as interactive React components. |

---

## Infrastructure and Utilities

| Package                | Description                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `pino`                 | Structured JSON logger used for server-side logging.                                             |
| `pino-pretty`          | Development-time formatter for Pino output.                                                      |
| `opossum`              | Circuit breaker library. Wraps calls to the Pi runtime to prevent cascading failures under load. |
| `zod`                  | Schema validation library. Used to parse and validate API request bodies.                        |
| `typebox`              | Runtime type system based on JSON Schema. Used alongside Zod for certain schema definitions.     |
| `diff`                 | Diff utility library for computing text/file diffs.                                              |
| `dotenv`               | Loads `.env` files into `process.env`.                                                           |
| `react-error-boundary` | React error boundary component for graceful error recovery in the UI.                            |

---

## Development Dependencies (Selected)

| Package                       | Description                                                             |
| ----------------------------- | ----------------------------------------------------------------------- |
| `turbo`                       | Monorepo task runner with caching.                                      |
| `typescript`                  | TypeScript compiler (v6).                                               |
| `eslint`                      | Linter.                                                                 |
| `prettier`                    | Code formatter.                                                         |
| `prettier-plugin-tailwindcss` | Prettier plugin that sorts Tailwind classes.                            |
| `husky`                       | Git hook manager.                                                       |
| `lint-staged`                 | Runs formatters/linters on staged files before commit.                  |
| `knip`                        | Dead code and unused dependency detector.                               |
| `jscpd`                       | Duplicate code detector.                                                |
| `syncpack`                    | Dependency version consistency checker.                                 |
| `vitest`                      | Unit test runner.                                                       |
| `@vitest/coverage-v8`         | V8 coverage provider for Vitest.                                        |
| `@playwright/test`            | End-to-end test framework.                                              |
| `rollup-plugin-visualizer`    | Generates the bundle size report (`apps/web/bundle-report/stats.html`). |
| `tsx`                         | TypeScript script runner used for one-off scripts.                      |
