# Fleet Pi — For Contributors

**A self-improving agent workspace. You bring the keys and the sandbox. The agent builds the rest.**

---

## What we're building

Fleet Pi is a **meta-harness** — a complete, self-hosted agent workspace built on [Pi](https://pi.dev/). The core idea is that the agent is simultaneously the worker and the architect of its own environment. It writes its own skills, registers its own prompts, evaluates its own output, and adapts to the user over time.

We believe the future of AI coding tools is:

- **Self-hosted** — your keys, your sandbox, your Git repo
- **Self-improving** — the agent grows its own capabilities
- **Auditable** — every file change is reviewable in Git
- **Extensible** — full TypeScript, not a limited plugin API

---

## The stack

| Layer             | Tech                              | Why                                            |
| ----------------- | --------------------------------- | ---------------------------------------------- |
| **Web framework** | TanStack Start                    | File-based routes, SSR, first-class TypeScript |
| **UI**            | `@workspace/hax-design`           | shadcn-style registry, agent-elements, OpenUI  |
| **Protocol**      | `@workspace/pi-protocol`          | Shared wire types and Zod schemas              |
| **Agent harness** | `@earendil-works/pi-coding-agent` | 77k stars, 5k+ community packages              |
| **Database**      | Neon Postgres                     | Serverless, branching, Managed Auth            |
| **Sandbox**       | Daytona                           | Per-user isolated environments                 |
| **Auth**          | Neon Managed Auth                 | Cookie + JWT, BYOK credential encryption       |

---

## Codebase structure

```
fleet-pi/
├── apps/web/                 # TanStack Start web app
│   ├── src/
│   │   ├── routes/           # File-based routes (index, login, api/*)
│   │   ├── lib/              # Server/client libraries
│   │   │   ├── pi/           # Pi integration (runtime, settings, plan mode)
│   │   │   ├── auth/         # Auth (Neon Managed Auth + Better Auth legacy)
│   │   │   ├── daytona/      # Daytona sandbox orchestration
│   │   │   ├── db/           # Postgres session mirroring, provenance, indexing
│   │   │   ├── workspace/    # Workspace bootstrap, contract, query, FS
│   │   │   └── deployment/   # Environment detection, readiness checks
│   │   └── routeTree.gen.ts  # Generated — do not edit
│   └── e2e/                  # Playwright end-to-end tests
├── packages/
│   ├── hax-design/           # All UI components (shadcn registry, fleet-pi, agent-elements, openui)
│   └── pi-protocol/          # Chat protocol types, Zod schemas, model patterns
├── agent-workspace/          # Durable agent workspace (memory, plans, evals, skills, .pi/)
├── .pi/                      # Pi settings, extensions, skills, prompts
├── .agents/skills/           # 30+ agent skills (code-review, impeccable, shadcn, neon, etc.)
└── docs/                     # Documentation
```

---

## What needs help

### High priority

- **Pi SDK upgrade tracking** — Pi is at v0.80.10 and evolving fast. We need to keep Fleet Pi compatible and adopt new SDK features as they land.
- **Workspace tooling** — The workspace-improver extension is a good start. We need better tools for the agent to audit, clean, and evolve its own workspace.
- **E2E test coverage** — The chat flow, plan mode, settings, and workspace panels need comprehensive Playwright tests.
- **Documentation** — Architecture docs, API reference, and runbooks need continuous improvement.

### Medium priority

- **Multi-provider model management** — The model catalog and provider credential UI need to handle more edge cases (provider switching, model discovery, credential rotation).
- **Daytona sandbox reliability** — Cold-start warm-up, volume recovery, and credential sync need hardening.
- **Auth hardening** — RLS policies, ownership probes, and session isolation need security review.
- **Bundle/composition system** — Dynamic agent composition (skills + tools + model per sub-goal) is an open design space.

### Low priority / nice to have

- **Theme system** — Custom themes through Pi's theme API
- **Mobile support** — Responsive layout for the chat UI
- **Plugin registry** — A registry for community-contributed workspace seeds

---

## Getting started

```zsh
git clone https://github.com/Qredence/fleet-pi.git
cd fleet-pi
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

**Prerequisites:** Node.js 22+, pnpm, and an LLM provider key (set `GEMINI_API_KEY` in `.env` for the default Gemini model).

**Validation commands:**

```zsh
pnpm lint          # ESLint
pnpm typecheck     # TypeScript
pnpm test          # Unit tests
pnpm build         # Full build
pnpm e2e           # Playwright tests
```

---

## Design principles

1. **The agent-workspace is the growth domain.** The agent modifies the workspace, never the platform code. The platform is stable and versioned; the workspace is where adaptation happens.

2. **Pi is the harness, not the product.** We build _on_ Pi, not _around_ it. We contribute upstream when possible instead of wrapping.

3. **BYOK is not optional.** Every user brings their own LLM keys, sandbox, and database. Fleet Pi never locks you into a provider.

4. **Complexity is structural, not accidental.** The provenance system, workspace abstraction, sandbox isolation, and plan mode are operating system primitives for a self-improving system — not feature bloat.

5. **Simplicity for the user, not for the code.** The codebase is 74,000 lines because the system does a lot. But the user's experience should be: clone, install, run, and the agent adapts.

---

## Community

- **GitHub:** [Qredence/fleet-pi](https://github.com/Qredence/fleet-pi)
- **Issues:** [github.com/Qredence/fleet-pi/issues](https://github.com/Qredence/fleet-pi/issues)
- **Discussions:** [github.com/Qredence/fleet-pi/discussions](https://github.com/Qredence/fleet-pi/discussions)
- **Pi Discord:** [discord.gg/3cU7Bz4UPx](https://discord.gg/3cU7Bz4UPx)
- **License:** Apache 2.0

All contributions welcome — code, docs, issues, discussions, or just trying it out and telling us what breaks.
