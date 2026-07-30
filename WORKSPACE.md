# Fleet Pi Workspace

> Non-authoritative snapshot. Prefer [AGENTS.md](AGENTS.md), [CONTEXT.md](CONTEXT.md), and generated [docs/project-structure.md](docs/project-structure.md) for current facts.

## SNAPSHOT

type: monorepo  
langs: TypeScript, JSON, YAML  
runtimes: Node.js ≥22  
pkgManager: pnpm@11.1.3  
deliverables: web app (TanStack Start + Pi coding agent), hax-design UI, pi-protocol wire types  
rootConfigs: pnpm-workspace.yaml, eslint.config.js, neon.ts, turbo.json

---

## PACKAGES

| name                   | path                 | role                                                                                    |
| ---------------------- | -------------------- | --------------------------------------------------------------------------------------- |
| web                    | apps/web             | Browser Pi chat workspace (Agent/Plan/Harness), auth, workspace APIs                    |
| @workspace/hax-design  | packages/hax-design  | Fleet Pi UI shell, agent-elements chat UI, openui renderer, shadcn/base-nova primitives |
| @workspace/pi-protocol | packages/pi-protocol | Chat wire types, Zod schemas, provider IDs, OpenUI prompt (no React)                    |

---

## ARCHITECTURE (web)

entry: `apps/web/src/routes/index.tsx`  
routing: TanStack Router file routes → `routeTree.gen.ts` (generated)  
api: `/api/chat/*`, `/api/workspace/*`, `/api/auth/*`, `/api/sandbox/*`, `/api/health`  
auth: Neon Managed Auth when `NEON_AUTH_*` set; local Better Auth/SQLite fallback  
llm: Neon AI Gateway (`NEON_AI_GATEWAY_*`) for authenticated deploy; BYOK via `pi_user_providers`  
db: Neon Postgres `pi_*` mirror + `pi_user_settings` on Vercel; local SQLite for auth when unset  
sandbox: Daytona BYOK per user on Vercel (`daytona` in `pi_user_providers`)

---

## STACK

- **web:** TanStack Start, React 19, Pi coding agent `^0.80.10`, Nitro/Vercel preset
- **default LLM (deploy):** Neon AI Gateway → `openai-chat-completions` / `qwen35-122b-a10b`
- **hax-design:** Tailwind v4, Base UI, Motion, Sonner
- **pi-protocol:** Zod, `@openuidev/lang-core` signatures

---

## STRUCTURE

- `agent-workspace/` — durable adaptive layer (memory, plans, artifacts, `pi/` resources)
- `agent-workspace/pi/{skills,prompts,extensions,packages}` — workspace-installed Pi resources
- `.pi/settings.json` — Pi compatibility bridge (overrides only; base defaults in code)
- `apps/web/src/lib/pi/runtime/` — session factory, settings bridge, Gateway/OCC providers
- `neon.ts` — Managed Auth + AI Gateway + chat Neon Function IaC

---

## BUILD

workspaceScripts: see root `package.json` and [AGENTS.md](AGENTS.md) Validation section.

Run `pnpm generate:docs` after OpenAPI or architecture generator changes.
Run `pnpm validate-agents-md` after AGENTS.md command changes.
