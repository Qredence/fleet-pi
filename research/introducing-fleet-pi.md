# Research: Introducing Fleet Pi

## Summary

Fleet Pi is a local browser workspace for Pi-powered coding agents. It gives
app developers a reviewable way to plan and execute coding work by keeping
durable plans, memory, skills, and artifacts in `agent-workspace/` and exposing
repo-scoped tools in the UI.

## Launch highlights

1. **Reviewable agent state in Git**
   - Durable memory, plans, skills, artifacts, and workspace-installed Pi
     resources live in `agent-workspace/`.
   - Sources: `README.md`, `docs/agent-workspace.md`,
     `docs/adaptive-workspace.md`
2. **Read-only Plan mode**
   - Plan mode inspects the repo, asks follow-up questions, and produces
     numbered execution plans before any file changes.
   - Sources: `README.md`, `apps/web/src/lib/pi/plan-mode.ts`
3. **Persistent chat sessions**
   - Pi sessions can resume after refresh, and the API exposes session
     management endpoints.
   - Sources: `README.md`, `docs/api.md`
4. **Repo-scoped coding tools**
   - Agent mode exposes `read`, `write`, `edit`, and `bash` against the active
     project root.
   - Sources: `README.md`, `docs/architecture.md`
5. **Local-first setup**
   - Runs locally with standard AWS Bedrock credentials and does not require a
     hosted SaaS account.
   - Sources: `README.md`, `docs/quickstart.md`
6. **Built-in resource and workspace browser**
   - The app surfaces project-local Pi resources plus a read-only workspace tree
     and file preview.
   - Sources: `docs/architecture.md`, `docs/api.md`

## Quickstart facts

```zsh
git clone https://github.com/Qredence/fleet-pi.git
cd fleet-pi
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

Open `http://localhost:3000`, then verify:

```zsh
curl http://localhost:3000/api/health
```

Expected response:

```json
{ "status": "ok" }
```

## Important prerequisites and caveats

- Node.js 22 or newer
- Working AWS Bedrock access and credentials are still required in standalone
  mode
- `AWS_REGION` defaults to `us-east-1` when unset
- Plan mode is intentionally read-only; code-changing work happens in Agent mode
- `docs/quickstart.md` mentions `pnpm 10.33.3`, while `package.json` pins
  `pnpm@11.0.9`; safer launch copy should tell readers to use Corepack and the
  repo-pinned version

## Recommended title

**Introducing Fleet Pi**

## Alternate titles

- Fleet Pi: A Local Coding-Agent Workspace with Durable Plans and Memory
- Meet Fleet Pi: Local-First Coding Agents with Plan Mode and Git-Native Memory

## Meta description

Fleet Pi is a local browser workspace for Pi-powered coding agents, with Plan
mode, persistent sessions, repo-scoped tools, and durable agent state in Git.

## Sources consulted

- `README.md`
- `docs/README.md`
- `docs/quickstart.md`
- `docs/architecture.md`
- `docs/api.md`
- `docs/project-structure.md`
- `docs/agent-workspace.md`
- `docs/adaptive-workspace.md`
- `docs/codex.md`
- `package.json`
- `.env.example`
- `apps/web/src/lib/pi/plan-mode.ts`
- `apps/web/src/routes/api/health.ts`
